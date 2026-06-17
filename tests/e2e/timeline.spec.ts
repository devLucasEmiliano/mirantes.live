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

test("timeline mostra commits e CI reais do projeto", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();
  await expect(page.getByText(/CI .*#1: sucesso/i)).toBeVisible();
});

test("trocar de projeto no header filtra o feed", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();

  await page.getByTestId("project-switcher").click();
  await page
    .getByTestId("project-option")
    .filter({ hasText: "Segundo Repo" })
    .click();

  await expect(page.getByText("feat: commit do segundo projeto")).toBeVisible();
  await expect(page.getByText("feat: pré-seed e2e")).toHaveCount(0);
});

test("dashboard sem card 'último commit' e com Atividade Recente real", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Último commit sincronizado")).toHaveCount(0);
  await expect(page.getByText("Atividade Recente")).toBeVisible();
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();
});

test("cliente não vê na timeline os commits do projeto do admin", async ({
  page,
}) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toHaveCount(0);
});
