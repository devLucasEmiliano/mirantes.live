import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin vê o projeto semeado com log e adiciona um novo", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");
  // O switcher do header também contém "mirantes.live" (nome do projeto raiz); por isso
  // escopamos a asserção à 1ª linha de projeto (strict mode rejeita match múltiplo).
  await expect(page.getByTestId("project-row").first()).toContainText(
    "mirantes.live",
  );
  await page.getByTestId("project-row").first().click(); // expandir
  await expect(page.getByTestId("commit-row").first()).toBeVisible();

  await page.getByTestId("add-project-owner").fill("e2e-owner");
  await page.getByTestId("add-project-repo").fill("e2e-repo");
  await page.getByRole("button", { name: /adicionar projeto/i }).click();
  await expect(page.getByText("e2e-owner/e2e-repo")).toBeVisible();
});

test("sincronizar sem PAT mostra mensagem amigável", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");
  await page.getByTestId("sync-now").first().click();
  await expect(
    page.getByText(/configure o github_pat|sem token/i),
  ).toBeVisible();
});

test("cliente não acessa Configurações e POST /api/projects → 403", async ({
  page,
}) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/configuracoes");
  await expect(page).toHaveURL(/\/dashboard$/); // redirecionado
  const res = await page.request.post("/api/projects", {
    data: { name: "Hack", owner: "x", repo: "y" },
  });
  expect(res.status()).toBe(403);
});

test("switcher do header mostra o nome real do projeto", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Mirantes.Live Dashboard")).toBeVisible();
});
