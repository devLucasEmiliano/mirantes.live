import { afterAll, afterEach } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

/**
 * Zera as tabelas entre testes (§5.3). TRUNCATE com CASCADE encadeia pelas FKs:
 * `users` limpa `sessions`/`avatars`; `projects` limpa `commits`/`branches`/
 * `workflow_runs`/`events`/`goals`/links (spec 008/012/013). `events` e `goals` são
 * nomeados à parte porque os GLOBAIS (`project_id NULL`) não têm pai p/ cascatear; o
 * TRUNCATE também zera a identity bigint do `events`. RESTART IDENTITY zera as sequences.
 */
export async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "users", "projects", "events", "goals" RESTART IDENTITY CASCADE`,
  );
}

export async function seedUser(input: {
  email: string;
  password: string;
  role?: string;
  name?: string | null;
}) {
  return db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role ?? "admin",
      name: input.name ?? null,
    },
  });
}

export function future(days = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

afterEach(truncateAll);
afterAll(async () => {
  await db.$disconnect();
});
