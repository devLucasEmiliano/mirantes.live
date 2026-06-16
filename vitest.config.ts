import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.test" });

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/db.ts"],
    fileParallelism: false, // um único banco de teste; evita corrida no truncate
    // Injeta o banco de teste ANTES de @/lib/env rodar loadEnv() (resolve o hoist de ESM):
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      REDIS_URL: process.env.TEST_REDIS_URL ?? "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "",
    },
  },
});
