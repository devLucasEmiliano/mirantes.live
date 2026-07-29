import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const MEMBER = { email: "equipe@mirantes.live", password: "equipe-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin gerencia equipe: cria, adiciona membro e atribui projeto", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByTestId("team-name-input").fill("Equipe QA E2E");
  await page.getByTestId("team-create").click();

  const row = page.getByTestId("team-row").filter({ hasText: "Equipe QA E2E" });
  await expect(row).toBeVisible();
  await row.getByTestId("team-row-toggle").click();

  await row
    .getByTestId("team-member-select")
    .selectOption({ label: "Membro Equipe" });
  await row.getByTestId("team-member-add").click();
  await expect(row.getByTestId("team-member-row")).toContainText(
    "Membro Equipe",
  );

  await row
    .getByTestId("team-project-select")
    .selectOption({ label: "devlucasemiliano/segundo-repo" });
  await row.getByTestId("team-project-add").click();
  await expect(row.getByTestId("team-project-row")).toContainText(
    "devlucasemiliano/segundo-repo",
  );
});

test("membro de equipe vê metas em somente leitura, sem controles de mutação", async ({
  page,
}) => {
  await login(page, MEMBER.email, MEMBER.password);
  await page.goto("/dashboard/metas");

  const switcher = page.getByTestId("team-project-switcher");
  await expect(switcher).toBeVisible();
  await expect(switcher).toContainText("Mirantes.Live Dashboard");

  const teamSection = page.getByTestId("team-metas-section");
  await expect(teamSection.getByText("Entregar login")).toBeVisible();
  await expect(teamSection.getByText("Publicar v1")).toBeVisible();
  await expect(
    teamSection.getByRole("link", { name: /Nova Meta/i }),
  ).toHaveCount(0);
  await expect(teamSection.getByLabel(/Arquivar meta/i)).toHaveCount(0);
});
