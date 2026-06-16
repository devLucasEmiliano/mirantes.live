import { execSync } from "node:child_process";
import { config } from "dotenv";

// Roda UMA vez antes de toda a suíte Vitest: garante o schema no banco de teste.
export default function globalSetup() {
  config({ path: ".env.test" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL ausente — crie .env.test (ver .env.example)");
  }
  // Prisma 7 lê DATABASE_URL via prisma.config.ts; apontamos p/ o banco de teste.
  execSync("bunx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
