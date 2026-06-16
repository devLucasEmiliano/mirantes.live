import { redis } from "../redis";

// Rate-limit do login (SPEC §3/§12): 5 tentativas / 15 min, com INCR+EXPIRE.
// Genérico por "identificador" — o login aplica em DUAS dimensões (ver
// login/route.ts): `ip:<ip>` e `email:<email>`. A dimensão por email é a defesa
// robusta: o IP vem do header X-Forwarded-For, que o cliente pode forjar quando não
// há proxy confiável à frente — sozinho, o limite por IP seria contornável.
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  ok: boolean;
  /** Segundos até liberar (só quando bloqueado) — vira header Retry-After. */
  retryAfter?: number;
}

/**
 * Conta tentativas de um identificador numa janela fixa (`ratelimit:login:<id>`).
 * A 1ª tentativa cria a chave e seu TTL; a partir da 6ª, bloqueia (429). Fail-open:
 * se o Redis cair, libera (rate-limit é best-effort; não tranca todos os logins).
 */
export async function checkLoginRateLimit(
  identifier: string,
): Promise<RateLimitResult> {
  const key = `ratelimit:login:${identifier}`;
  try {
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }
    if (attempts > MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      return { ok: false, retryAfter: ttl > 0 ? ttl : WINDOW_SECONDS };
    }
    return { ok: true };
  } catch (error) {
    console.error(
      "[rate-limit] Redis indisponível, liberando tentativa:",
      error,
    );
    return { ok: true };
  }
}

/** Zera o contador de um identificador (no login bem-sucedido). Best-effort. */
export async function clearLoginRateLimit(identifier: string): Promise<void> {
  try {
    await redis.del(`ratelimit:login:${identifier}`);
  } catch (error) {
    console.error("[rate-limit] falha ao limpar contador:", error);
  }
}
