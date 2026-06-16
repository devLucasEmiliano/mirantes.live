import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

// Funções puras do cookie de sessão — SEM `next/headers`, para poderem rodar tanto
// no DAL (Route Handlers / Server Components) quanto no `proxy.ts` (gate barato).
// O Postgres guarda a sessão; o cookie carrega só o id assinado por HMAC.

/** Nome do cookie httpOnly de sessão. */
export const SESSION_COOKIE_NAME = "gg_session";

/** Vida do cookie/sessão: 7 dias, sliding (SPEC §12). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sign(value: string): string {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}

/** Token do cookie: `<sessionId>.<assinatura HMAC>`. */
export function signSessionToken(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/**
 * Devolve o `sessionId` se a assinatura confere (comparação time-safe), senão null.
 * É a checagem "ótimista" — prova que o id saiu do servidor, sem tocar no banco.
 */
export function verifySessionToken(
  token: string | null | undefined,
): string | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const sessionId = token.slice(0, separator);
  const expected = sign(sessionId);
  const provided = Buffer.from(token.slice(separator + 1));
  const expectedBytes = Buffer.from(expected);
  if (provided.length !== expectedBytes.length) return null;
  if (!timingSafeEqual(provided, expectedBytes)) return null;
  return sessionId;
}

/**
 * Opções do cookie de sessão. `Secure` só em produção: em dev o login roda sobre
 * http://localhost, onde cookies `Secure` não seriam enviados.
 */
export function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
