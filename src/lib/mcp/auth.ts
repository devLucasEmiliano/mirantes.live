// Auth do servidor MCP (spec 013 → 019): resolve um token → escopo. Ordem (fail-closed):
//   1. sem token → null;
//   2. `MCP_SERVICE_TOKEN` (env, se configurado) → escopo ADMIN (compat de operador/local);
//   3. token pessoal (spec 019): `sha256(token)` casa um `mcp_tokens` ativo → `{ client, userId }`
//      e carimba `lastUsedAt` (await, p/ determinismo de teste);
//   4. desconhecido/revogado → null.
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Scope } from "@/lib/projects";
import { hashToken } from "./tokens";

export async function resolveScopeFromToken(
  token: string | undefined,
): Promise<Scope | null> {
  if (!token) return null;

  const expected = env.MCP_SERVICE_TOKEN;
  if (expected && token === expected) return { role: "admin" };

  const row = await db.mcpToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.revokedAt !== null) return null;

  await db.mcpToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  });
  return { role: "client", userId: row.userId };
}
