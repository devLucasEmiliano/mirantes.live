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

test("admin vê metas reais: M-1 em progresso e M-2 concluída", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/metas");
  await expect(page.getByText("Entregar login")).toBeVisible();
  await expect(page.getByText("M-1")).toBeVisible();
  await expect(page.getByText("Publicar v1")).toBeVisible();
  await expect(page.getByText(/Conclu[íi]d/i)).toBeVisible();
});

test("admin cria meta com alvo e ela aparece com short code", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/metas/nova");
  await page.getByLabel(/T[íi]tulo/i).fill("Migrar banco");
  await page.getByLabel(/Alvo/i).fill("5");
  await page.getByRole("button", { name: /Criar|Salvar/i }).click();
  await page.waitForURL("**/dashboard/metas");
  await expect(page.getByText("Migrar banco")).toBeVisible();
  await expect(page.getByText("M-3")).toBeVisible();
});

test("cliente não vê as metas do projeto do admin", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/metas");
  await expect(page.getByText("Entregar login")).toHaveCount(0);
});
