import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";
import { db } from "@/lib/db";

// Serviço da conexão OAuth do usuário com o GitHub (spec 009). O token vai/volta do
// Postgres SEMPRE cifrado (crypto/secret.ts); `resolveUserToken` é a única porta que
// devolve o token em claro — só p/ uso imediato em memória (sync). Nunca loga/expõe.

export interface GithubConnectionInput {
  accessToken: string;
  login: string;
  githubUserId: number;
  scopes: string;
}

export interface ConnectionStatus {
  connected: boolean;
  githubLogin: string | null;
  connectedAt: Date | null;
}

export type ResolveTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: "not_connected" | "invalid_token" };

/** Cifra o token e grava/atualiza a conexão (1:1 por usuário). */
export async function connectGithub(
  userId: string,
  input: GithubConnectionInput,
): Promise<void> {
  const enc = encryptSecret(input.accessToken);
  const data = {
    tokenCiphertext: enc.ciphertext,
    tokenIv: enc.iv,
    tokenAuthTag: enc.authTag,
    githubLogin: input.login,
    githubUserId: BigInt(input.githubUserId),
    scopes: input.scopes,
  };
  await db.githubConnection.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

/** Remove a conexão. `deleteMany` é idempotente (sem row → 0 apagadas, sem erro). */
export async function disconnectGithub(userId: string): Promise<void> {
  await db.githubConnection.deleteMany({ where: { userId } });
}

/**
 * Estado da conexão p/ a UI. `select` deliberado: NUNCA carrega os campos do token,
 * então o objeto devolvido não tem como vazar o segredo.
 */
export async function getConnectionStatus(
  userId: string,
): Promise<ConnectionStatus> {
  const row = await db.githubConnection.findUnique({
    where: { userId },
    select: { githubLogin: true, connectedAt: true },
  });
  if (!row) return { connected: false, githubLogin: null, connectedAt: null };
  return {
    connected: true,
    githubLogin: row.githubLogin,
    connectedAt: row.connectedAt,
  };
}

/**
 * Decifra o token do dono p/ uso imediato (sync). `not_connected` sem row;
 * `invalid_token` se a decifra lança (adulteração/chave errada — integridade do GCM).
 */
export async function resolveUserToken(
  userId: string,
): Promise<ResolveTokenResult> {
  const row = await db.githubConnection.findUnique({
    where: { userId },
    select: { tokenCiphertext: true, tokenIv: true, tokenAuthTag: true },
  });
  if (!row) return { ok: false, error: "not_connected" };
  try {
    const token = decryptSecret({
      ciphertext: row.tokenCiphertext,
      iv: row.tokenIv,
      authTag: row.tokenAuthTag,
    });
    return { ok: true, token };
  } catch {
    return { ok: false, error: "invalid_token" };
  }
}
