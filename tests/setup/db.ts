import { afterAll, afterEach } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

/**
 * Zera as tabelas entre testes (§5.3). TRUNCATE em `users` com CASCADE limpa também
 * `sessions` e `avatars` (FK → users) — e funciona mesmo antes da migração que cria
 * `avatars` (não falha por tabela ainda inexistente no passo 1).
 */
export async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
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
