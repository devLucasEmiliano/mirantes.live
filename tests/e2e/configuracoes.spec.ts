import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };

// getByLabel com { exact: true }: os campos de senha têm um botão "Mostrar senha"
// (aria-label) e "Nova Senha" é substring de "Confirmar Nova Senha" — sem exact, o
// matcher por rótulo resolveria para 2 elementos (strict mode violation).
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("troca de senha: nova passa a valer, antiga falha", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Senha Atual", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Nova Senha", { exact: true }).fill("nova-senha-2026");
  await page
    .getByLabel("Confirmar Nova Senha", { exact: true })
    .fill("nova-senha-2026");
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/senha atualizada/i)).toBeVisible();

  await page.goto("/login");
  await login(page, ADMIN.email, "nova-senha-2026");
  await expect(page).toHaveURL(/dashboard/);

  // Restaura a senha original para não acoplar os demais testes.
  await page.goto("/dashboard/configuracoes");
  await page.getByLabel("Senha Atual", { exact: true }).fill("nova-senha-2026");
  await page.getByLabel("Nova Senha", { exact: true }).fill(ADMIN.password);
  await page
    .getByLabel("Confirmar Nova Senha", { exact: true })
    .fill(ADMIN.password);
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/senha atualizada/i)).toBeVisible();
});

test("perfil: editar nome persiste e atualiza as iniciais", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Nome", { exact: true }).fill("Admin Renomeado");
  await page.getByRole("button", { name: "Salvar Perfil" }).click();
  await expect(page.getByText(/perfil atualizado/i)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
    "Admin Renomeado",
  );
  await expect(page.getByTestId("avatar-initials")).toHaveText("AR");

  // Restaura o nome original.
  await page.getByLabel("Nome", { exact: true }).fill("Admin Mirantes");
  await page.getByRole("button", { name: "Salvar Perfil" }).click();
  await expect(page.getByText(/perfil atualizado/i)).toBeVisible();
});

test("perfil: upload de foto aparece, persiste e some ao remover", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await expect(page.getByTestId("avatar-initials")).toBeVisible();
  await expect(page.getByTestId("sidebar-avatar-initials")).toBeVisible();

  await page
    .getByTestId("avatar-input")
    .setInputFiles("tests/fixtures/avatar.png");
  await expect(page.getByText(/foto atualizada/i)).toBeVisible();
  await expect(page.getByTestId("avatar-image")).toBeVisible();
  // A sidebar (server component) reflete a foto via o router.refresh() do form.
  await expect(page.getByTestId("sidebar-avatar-image")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("avatar-image")).toBeVisible();
  await expect(page.getByTestId("sidebar-avatar-image")).toBeVisible();

  await page.getByRole("button", { name: /remover foto/i }).click();
  await expect(page.getByText(/foto removida/i)).toBeVisible();
  await expect(page.getByTestId("avatar-initials")).toBeVisible();
  await expect(page.getByTestId("sidebar-avatar-initials")).toBeVisible();
});

test("senha: nova ≠ confirmar bloqueia no client (sem request)", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Senha Atual", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Nova Senha", { exact: true }).fill("aaaaaaaa");
  await page
    .getByLabel("Confirmar Nova Senha", { exact: true })
    .fill("bbbbbbbb");
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/não conferem|não coincidem/i)).toBeVisible();
});
