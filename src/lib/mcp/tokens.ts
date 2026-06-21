// Tokens pessoais do MCP (spec 019): única porta ao Postgres do domínio de tokens. Cada usuário
// gera N tokens de alta entropia; guardamos só o `tokenHash` (sha256 hex, @unique → lookup O(1))
// e um `tokenPrefix` curto p/ exibir. O texto puro é devolvido UMA vez por `createMcpToken` e
// nunca persiste. SHA-256 (não argon2): tokens já são aleatórios (256 bits), então um KDF lento
// não agrega segurança e impediria a busca por igualdade exata (salt por registro).
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

/** Projeção segura de um token p/ leitura/UI — sem `tokenHash`, com `prefix` (não o texto puro). */
export interface McpTokenView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

// base62 ([0-9A-Za-z]) p/ o corpo do token: legível, copiável e casa com `^mir_[0-9A-Za-z]+$`.
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BODY_LEN = 43; // ~256 bits de entropia; token final "mir_" + 43 = 47 chars.

/** Corpo base62 de comprimento fixo, sem viés de módulo (descarta bytes ≥ 248 = 62×4). */
function base62Body(): string {
  let out = "";
  while (out.length < BODY_LEN) {
    for (const byte of randomBytes(BODY_LEN)) {
      if (byte < 248) {
        out += ALPHABET[byte % 62];
        if (out.length === BODY_LEN) break;
      }
    }
  }
  return out;
}

/** Gera um token puro (`mir_…`) e o seu prefixo curto de exibição. Puro (node:crypto). */
export function generateMcpToken(): { token: string; prefix: string } {
  const token = `mir_${base62Body()}`;
  const prefix = `${token.slice(0, 12)}…`;
  return { token, prefix };
}

/** sha256(token) em hex (64 chars). Determinístico e puro. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toView(row: {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): McpTokenView {
  return {
    id: row.id,
    name: row.name,
    prefix: row.tokenPrefix,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

/** Cria um token do usuário: grava só hash+prefixo e devolve o texto puro UMA vez. */
export async function createMcpToken(
  userId: string,
  name: string,
): Promise<{ token: string; view: McpTokenView }> {
  const { token, prefix } = generateMcpToken();
  const row = await db.mcpToken.create({
    data: { userId, name, tokenHash: hashToken(token), tokenPrefix: prefix },
  });
  return { token, view: toView(row) };
}

/** Lista os tokens do usuário (sem `tokenHash`), mais recentes primeiro. */
export async function listMcpTokens(userId: string): Promise<McpTokenView[]> {
  const rows = await db.mcpToken.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toView);
}

/** Revoga um token do PRÓPRIO usuário (idempotente). Token alheio/inexistente → `{ ok: false }`. */
export async function revokeMcpToken(
  userId: string,
  id: string,
): Promise<{ ok: boolean }> {
  const { count } = await db.mcpToken.updateMany({
    where: { id, userId },
    data: { revokedAt: new Date() },
  });
  return { ok: count > 0 };
}
