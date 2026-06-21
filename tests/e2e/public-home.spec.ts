import { expect, test } from "@playwright/test";

// Pré-condição (seed e2e): ≥2 projetos PÚBLICOS de donos diferentes com metas/eventos + 1 privado.
// (memória: parar `next dev` antes de rodar; seed e2e é flaky no Windows — re-rodar se crashar.)

test("visitante vê dados reais e troca de projeto público pelo seletor", async ({
  page,
}) => {
  await page.goto("/");
  // cards reais (não o mock): há um Progresso Total e a lista de metas do projeto público mais antigo
  await expect(page.getByText("Progresso Total")).toBeVisible();
  const switcher = page.getByTestId("public-project-switcher");
  await switcher.click();
  await page.getByTestId("public-project-option").nth(1).click();
  // URL passa a carregar ?projeto=owner/repo (compartilhável) e o conteúdo muda
  await expect(page).toHaveURL(/\/\?projeto=/);
});

test("projeto privado não aparece no seletor e a / é read-only", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByTestId("public-project-switcher").click();
  await expect(page.getByText("secret")).toHaveCount(0); // repo privado ausente
  // nenhuma ação de edição na home pública
  await expect(
    page.getByRole("button", { name: /editar|salvar|tornar público/i }),
  ).toHaveCount(0);
});

test.skip("admin torna público + renomeia em Integrações e a / reflete", async () => {
  // login admin → /dashboard/integracoes → expandir projeto privado → renomear + toggle Público
  // ... (helpers de login do harness e2e existente)
  // depois: logout/visitante → / → seletor lista o novo nome
});
