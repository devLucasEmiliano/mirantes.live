import { expect, test } from "@playwright/test";

// Home pública (anônima, sem login): a "Atividade Recente" é o feed real da VITRINE (projeto
// mais antigo de um admin), só `visibleToClient`. Spec 012 — divergência aprovada.

test("home pública mostra atividade real da vitrine", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Atividade Recente")).toBeVisible();
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();
});

test("home pública não expõe eventos invisíveis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("evento oculto e2e")).toHaveCount(0);
});
