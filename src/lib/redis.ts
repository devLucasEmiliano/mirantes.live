import Redis from "ioredis";
import { env } from "./env";

// Singleton ioredis (cache + rate-limit). O padrão `globalThis` evita abrir uma
// conexão nova a cada hot-reload do `next dev`. Pub/Sub fica para a spec de SSE.
const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedis(): Redis {
  // `lazyConnect`: conecta só no primeiro comando (não no import, importante para
  // o `next build`). Falhas são logadas, não derrubam o processo — leituras e
  // rate-limit têm fallback próprio.
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });
  client.on("error", (error) => {
    console.error("[redis] erro de conexão:", error.message);
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
