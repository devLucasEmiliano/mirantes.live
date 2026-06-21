import { expect, type Page, test } from "@playwright/test";

// Jornada de tokens MCP por usuário (spec 019): na tela de Integrações, o usuário gera um token
// pessoal — o texto puro aparece UMA vez — e depois o revoga, sumindo da lista ativa. O banco do
// e2e não é resetado entre execuções; por isso o teste mira a linha pelo PREFIXO do token recém
// gerado (único por execução), não por contagem.

const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("gera um token MCP (exibido uma vez) e revoga", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");

  // Gera o token.
  await page.getByTestId("mcp-token-name").fill("E2E Notebook");
  await page.getByTestId("mcp-token-generate").click();

  // O texto puro aparece UMA vez, começa com `mir_`.
  const plain = page.getByTestId("mcp-token-plaintext");
  await expect(plain).toBeVisible();
  const tokenText = ((await plain.textContent()) ?? "").trim();
  expect(tokenText.startsWith("mir_")).toBe(true);

  // O token entra na lista pelo seu prefixo (12 chars + "…").
  const prefix = `${tokenText.slice(0, 12)}…`;
  const row = page.locator(
    `[data-testid="mcp-token-row"][data-prefix="${prefix}"]`,
  );
  await expect(row).toHaveCount(1);

  // Revoga → some da lista ativa.
  await row.getByTestId("mcp-token-revoke").click();
  await expect(row).toHaveCount(0);
});
