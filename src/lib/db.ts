import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Singleton do Prisma Client (padrão `globalThis` p/ não recriar a cada hot-reload
// do `next dev`). No Prisma 7 o client exige um driver adapter — usamos o oficial
// de Postgres (@prisma/adapter-pg), que gere o pool de conexões internamente.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  // Opções do pool `pg` (o adapter repassa direto). Postgres mora numa LAN, onde
  // roteador/firewall derrubam sockets ociosos em silêncio — sem keepalive o pool
  // entrega uma conexão morta e a query trava até o timeout interno do Prisma
  // ("Operation has timed out"). Estas opções detectam/reciclam o socket antes:
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Mantém o socket TCP vivo p/ não ser reapeado por NAT/firewall ociosos.
    keepAlive: true,
    // Recicla conexões ociosas antes do roteador as matar (30s < janela típica).
    idleTimeoutMillis: 30_000,
    // Falha rápido se não conseguir conectar, em vez de pendurar a request.
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
