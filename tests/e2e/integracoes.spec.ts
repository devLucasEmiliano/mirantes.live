import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin conecta o GitHub (OAuth faked) e desconecta", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const start = await page.request.get("/api/github/oauth/start", {
    maxRedirects: 0,
  });
  const state = new URL(start.headers().location).searchParams.get("state");
  const cb = await page.request.get(
    `/api/github/oauth/callback?code=fake&state=${state}`,
    { maxRedirects: 0 },
  );
  expect(cb.status()).toBe(303);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText(/conectado como @e2e-bot/i)).toBeVisible();
  await page.getByRole("button", { name: /desconectar/i }).click();
  await expect(
    page.getByRole("button", { name: /conectar github/i }),
  ).toBeVisible();
});

test("cliente vê só os seus projetos; admin vê todos", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText("cliente-owner/cliente-repo")).toBeVisible();
  await expect(page.getByText("devlucasemiliano/mirantes.live")).toHaveCount(0);

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText("devlucasemiliano/mirantes.live")).toBeVisible();
  await expect(page.getByText("cliente-owner/cliente-repo")).toBeVisible();
});

test("cliente acessa Integrações mas não Configurações", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await expect(page).toHaveURL(/\/integracoes$/);
  await page.goto("/dashboard/configuracoes");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("cliente: sincronizar sem conexão pede para conectar", async ({
  page,
}) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await page.getByTestId("sync-now").first().click();
  await expect(page.getByText(/conecte sua conta do github/i)).toBeVisible();
});

test("cliente cria o seu projeto e não toca no de outro (404)", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  const adminId = (
    await (await page.request.get("/api/projects")).json()
  ).projects.find((p: { repo: string }) => p.repo === "mirantes.live").id;

  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await page.getByTestId("add-project-owner").fill("cli-novo");
  await page.getByTestId("add-project-repo").fill("repo-novo");
  await page.getByRole("button", { name: /adicionar projeto/i }).click();
  await expect(page.getByText("cli-novo/repo-novo")).toBeVisible();

  expect(
    (await page.request.post(`/api/projects/${adminId}/sync`)).status(),
  ).toBe(404);
  expect((await page.request.delete(`/api/projects/${adminId}`)).status()).toBe(
    404,
  );
});
