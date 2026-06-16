import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.test" });

const PORT = 3100;
const webEnv = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
  REDIS_URL: process.env.TEST_REDIS_URL ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  PORT: String(PORT),
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  timeout: 90_000, // next dev compila a rota no 1º acesso — folga p/ a navegação
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    navigationTimeout: 60_000,
    actionTimeout: 15_000, // falha rápido em elemento ausente (red) ou bug real
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: webEnv,
  },
});
