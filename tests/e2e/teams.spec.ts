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

// O banco de teste NÃO é truncado entre execuções da suíte e2e (só re-semeado), e a equipe
// criada aqui fica. Nome único por execução p/ o locator da linha nunca casar 2 equipes.
const TEAM_NAME = `Equipe QA E2E ${Date.now()}`;

test("admin gerencia equipe: cria, busca membro e atribui projeto", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByTestId("team-name-input").fill(TEAM_NAME);
  await page.getByTestId("team-create").click();

  const row = page.getByTestId("team-row").filter({ hasText: TEAM_NAME });
  await expect(row).toBeVisible();
  await row.getByTestId("team-row-toggle").click();

  // Membro: o picker começa fechado; abre pelo link.
  await expect(row.getByTestId("team-member-search")).toHaveCount(0);
  await row.getByTestId("team-member-picker-open").click();
  await expect(row.getByTestId("team-member-search")).toBeVisible();

  // A busca precisa REALMENTE filtrar: com "membro" sobra só o usuário semeado.
  await row.getByTestId("team-member-search").fill("membro");
  await expect(row.getByTestId("team-member-option")).toHaveCount(1);
  await expect(row.getByTestId("team-member-option")).toContainText(
    "Membro Equipe",
  );
  await row.getByTestId("team-member-option").click();

  // Folga acima dos 5s padrão do expect: o POST + router.refresh() cai no 1º hit da rota,
  // que o `next dev` ainda está compilando (o resto da suíte roda no mesmo servidor).
  await expect(row.getByTestId("team-member-row")).toContainText(
    "Membro Equipe",
    { timeout: 30_000 },
  );
  // Adicionado some da busca (não dá para adicionar duas vezes).
  await row.getByTestId("team-member-picker-open").click();
  await row.getByTestId("team-member-search").fill("membro");
  await expect(row.getByTestId("team-member-option")).toHaveCount(0);

  // Projeto: mesma mecânica.
  await row.getByTestId("team-project-picker-open").click();
  await row.getByTestId("team-project-search").fill("segundo");
  await expect(row.getByTestId("team-project-option")).toHaveCount(1);
  await row.getByTestId("team-project-option").click();

  await expect(row.getByTestId("team-project-row")).toContainText(
    "devlucasemiliano/segundo-repo",
    { timeout: 30_000 },
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
