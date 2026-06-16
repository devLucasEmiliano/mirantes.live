import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Config da CLI do Prisma 7 (substitui o bloco `datasource.url` do schema e a chave
// `prisma` do package.json). O `dotenv/config` carrega o .env — a CLI do Prisma 7
// não faz mais isso sozinha. A `url` aqui é usada só por migrate/reset (conexão
// direta); em runtime o client usa o driver adapter (src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
