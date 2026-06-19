import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("Visão Geral mostra metas reais (não mock)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Metas do Projeto")).toBeVisible();
  await expect(page.getByText("Entregar login")).toBeVisible();
  // exact: o código curto "M-1" também é substring de "feat: tela de login (M-1)"
  // no feed de atividade — exact evita a colisão e mira só o shortCode da meta.
  await expect(page.getByText("M-1", { exact: true })).toBeVisible();
  // Card "Metas Concluídas": 1 de 2 (M-2 done).
  await expect(page.getByText("1/2")).toBeVisible();
  // Não vaza título exclusivo do mock antigo.
  await expect(page.getByText("Desenvolvimento do Backend")).toHaveCount(0);
});
