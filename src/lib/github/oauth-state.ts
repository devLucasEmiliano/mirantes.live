import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Anti-CSRF do fluxo OAuth (SPEC §11). Espelha auth/cookie.ts: um payload assinado
// por HMAC-SHA256 com SESSION_SECRET, SEM estado no servidor. O `state` viaja na URL
// do GitHub (`/authorize?...&state=`) e volta no callback, onde é verificado e também
// comparado byte-a-byte com o cookie httpOnly que a rota /start gravou.

const TTL_MS = 600_000; // 10 min — janela de vida do fluxo de autorização

function sign(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

/** state = `<userId>.<nonce>.<expiry>.<assinatura HMAC>`. */
export function createOAuthState(
  userId: string,
  now: number = Date.now(),
): string {
  const payload = `${userId}.${randomBytes(16).toString("base64url")}.${now + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Devolve `{ userId }` se a assinatura confere (time-safe) e o state não expirou;
 * senão null. Verifica a assinatura ANTES de ler o payload — só então os campos
 * (userId/expiry) são confiáveis.
 */
export function verifyOAuthState(
  token: string | null | undefined,
  now: number = Date.now(),
): { userId: string } | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const [userId, , expiryRaw] = parts;
  const expiry = Number(expiryRaw);
  if (!userId || !Number.isFinite(expiry) || now > expiry) return null;
  return { userId };
}

/** Nome do cookie httpOnly (one-shot) que carrega o `state` durante o fluxo. */
export const OAUTH_STATE_COOKIE = "gg_gh_oauth_state";
/** Escopo do cookie de state — restrito às rotas do fluxo OAuth (/start e /callback). */
export const OAUTH_STATE_COOKIE_PATH = "/api/github/oauth";
