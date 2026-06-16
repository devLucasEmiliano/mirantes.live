import { redis } from "../redis";

// Rate-limit do login por IP (SPEC §3/§12): 5 tentativas / 15 min, com INCR+EXPIRE.
const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

export interface RateLimitResult {
  ok: boolean;
  /** Segundos até liberar (só quando bloqueado) — vira header Retry-After. */
  retryAfter?: number;
}

/**
 * Conta tentativas por IP numa janela fixa. A 1ª tentativa cria a chave e seu TTL;
 * a partir da 6ª, bloqueia (429). Fail-open: se o Redis cair, libera a tentativa
 * (o rate-limit é best-effort; não deve trancar todos os logins por causa do cache).
 */
export async function checkLoginRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  const key = `ratelimit:login:${ip}`;
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
