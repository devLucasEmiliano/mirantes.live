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
