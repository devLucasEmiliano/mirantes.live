import { execSync } from "node:child_process";
import { config } from "dotenv";

// Antes da suíte e2e: schema + seed (admin/cliente conhecidos) no banco de teste.
export default function globalSetup() {
  config({ path: ".env.test" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL ausente (.env.test)");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    REDIS_URL: process.env.TEST_REDIS_URL ?? "",
  };
  execSync("bunx prisma migrate deploy", { stdio: "inherit", env });
  execSync("bunx prisma db seed", { stdio: "inherit", env });
  // Pré-seed do log de atividade (commits/branch/run) do projeto dev — determinístico
  // p/ a jornada de Projetos (spec 008). Idempotente; roda no runtime real (bun).
  execSync("bun run tests/e2e/seed-activity.ts", { stdio: "inherit", env });
  // Projeto do cliente (cliente-owner/cliente-repo) p/ a jornada de Integrações (spec 009).
  execSync("bun run tests/e2e/seed-connections.ts", { stdio: "inherit", env });
  // Eventos da timeline (spec 012): 2º projeto do admin + backfill dos commits/runs semeados.
  execSync("bun run tests/e2e/seed-events.ts", { stdio: "inherit", env });
  // Metas da spec 013: metas reais (M-1 1/2, M-2 concluída) no projeto-vitrine do admin (idempotente).
  execSync("bun run tests/e2e/seed-metas.ts", { stdio: "inherit", env });
}
