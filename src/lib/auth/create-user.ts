import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "./password";

// Provisionamento de conta fora do seed (PRD §2: "contas provisionadas por seed/script";
// sem cadastro público, sem UI de gestão de contas). Diferente do `prisma/seed.ts`
// (credenciais FIXAS de dev, sempre as mesmas), este script gera uma senha aleatória
// e a IMPRIME UMA ÚNICA VEZ — nunca fica em texto no repo. `create` (não `upsert`):
// se o email já existir, falha alto em vez de sobrescrever a senha de alguém.

function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

export async function createUser(
  email: string,
  role: "admin" | "client",
  name?: string,
): Promise<{ email: string; role: string; password: string }> {
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { email, passwordHash, role, name },
  });
  return { email: user.email, role: user.role, password };
}

// Auto-run direto (`bun run src/lib/auth/create-user.ts <email> [admin|client] [nome]`).
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const [email, roleArg, name] = process.argv.slice(2);
  const role = roleArg === "admin" ? "admin" : "client";
  if (!email) {
    console.error(
      "uso: bun run src/lib/auth/create-user.ts <email> [admin|client] [nome]",
    );
    process.exitCode = 1;
  } else {
    createUser(email, role, name)
      .then((result) => {
        console.log(`Usuário criado: ${result.email} (${result.role})`);
        console.log(`Senha (mostrada uma única vez): ${result.password}`);
      })
      .catch((error) => {
        console.error("create-user falhou:", error);
        process.exitCode = 1;
      })
      .finally(async () => {
        await db.$disconnect();
      });
  }
}
