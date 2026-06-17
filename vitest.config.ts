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
      // OAuth App do GitHub (spec 009). CLIENT_ID/SECRET nunca vão à rede nos
      // testes: connection usa tokens literais e o e2e usa GITHUB_OAUTH_FAKE.
      GITHUB_OAUTH_CLIENT_ID:
        process.env.GITHUB_OAUTH_CLIENT_ID ?? "test-client-id",
      GITHUB_OAUTH_CLIENT_SECRET:
        process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "test-client-secret",
      // Chave AES-256-GCM real (32 bytes base64) — cifra de verdade nos testes (§5.3).
      GITHUB_TOKEN_ENC_KEY:
        process.env.GITHUB_TOKEN_ENC_KEY ??
        "CC0ZHvIj+wPc9tkJ3t/H8JbtGdAAYCjFJ6wS+bjDujs=",
      APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    },
  },
});
