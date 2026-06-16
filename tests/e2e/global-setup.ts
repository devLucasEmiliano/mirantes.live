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
}
