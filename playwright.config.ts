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
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: webEnv,
  },
});
