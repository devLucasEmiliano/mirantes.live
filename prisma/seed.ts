import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";
import { writeHomeSnapshot } from "../src/lib/home-snapshot";
import { redis } from "../src/lib/redis";

// Seed idempotente (task 003): provisiona os 2 usuários (não há cadastro público —
// PRD §2) e grava o snapshot público da home no Redis. Credenciais FIXAS de dev,
// impressas ao final (somente desenvolvimento). Roda via `prisma db seed` (tsx),
// que carrega o .env antes — por isso process.env tem DATABASE_URL/REDIS_URL/etc.

const DEV_USERS = [
  {
    email: "admin@mirantes.live",
    password: "admin-dev-2026",
    role: "admin",
    name: "Admin Mirantes",
  },
  {
    email: "cliente@mirantes.live",
    password: "cliente-dev-2026",
    role: "client",
    name: "Lucas Cliente",
  },
] as const;

// Projeto dev (spec 008): 1 repositório real. Upsert idempotente por (owner, repo).
// Sem commits/branches/runs aqui — esses vêm do sync (ou do pré-seed e2e por fixtures).
const DEV_PROJECT = {
  name: "Mirantes.Live Dashboard",
  owner: "devlucasemiliano",
  repo: "mirantes.live",
} as const;

async function main() {
  console.log("→ Semeando usuários (upsert por email)...");
  for (const user of DEV_USERS) {
    const passwordHash = await hashPassword(user.password);
    await db.user.upsert({
      where: { email: user.email },
      update: { passwordHash, role: user.role, name: user.name },
      create: {
        email: user.email,
        passwordHash,
        role: user.role,
        name: user.name,
      },
    });
  }

  console.log("→ Semeando projeto dev (upsert por owner/repo)...");
  await db.project.upsert({
    where: {
      owner_repo: { owner: DEV_PROJECT.owner, repo: DEV_PROJECT.repo },
    },
    update: { name: DEV_PROJECT.name },
    create: DEV_PROJECT,
  });

  console.log(
    "→ Gravando snapshot público da home no Redis (home:snapshot)...",
  );
  const snapshot = await writeHomeSnapshot();

  console.log("\n✓ Seed concluído.\n");
  console.log("Credenciais de DESENVOLVIMENTO (não usar em produção):");
  for (const user of DEV_USERS) {
    console.log(
      `  • ${user.role.padEnd(6)}  ${user.email}  /  ${user.password}`,
    );
  }
  console.log(
    `\nHome snapshot: "${snapshot.projectName}" (live=${snapshot.live}).`,
  );
}

main()
  .catch((error) => {
    console.error("Seed falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    redis.disconnect();
  });
