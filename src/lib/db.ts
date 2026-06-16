import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Singleton do Prisma Client (padrão `globalThis` p/ não recriar a cada hot-reload
// do `next dev`). No Prisma 7 o client exige um driver adapter — usamos o oficial
// de Postgres (@prisma/adapter-pg), que gere o pool de conexões internamente.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
