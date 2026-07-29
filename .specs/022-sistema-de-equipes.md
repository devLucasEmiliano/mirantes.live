---
id: 022
title: Sistema de equipes — acesso compartilhado (leitura) às metas de um projeto
status: done      # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-07-29
---

## Divergência da implementação em relação ao plano

- **`selectMetasTeamProject` não ficou em `src/lib/goals/team-select.ts`** como planejado.
  Colocar a Server Action ("use server") no mesmo arquivo que `resolveTeamProjectSelection`
  (que importa `@/lib/teams` → `@/lib/db` → `pg`) fazia o bundler do Client Component
  (`team-metas-section.tsx`) arrastar `pg`/Prisma para o browser (`Module not found: net/tls`,
  confirmado no e2e). Movida para **`src/lib/goals/team-actions.ts`** (arquivo `"use server"`
  dedicado), espelhando exatamente `@/lib/projects/actions.ts` vs. `@/lib/projects/select.ts`.
  `team-select.ts` ficou só com `pickTeamProject` (puro) e `resolveTeamProjectSelection`
  (Server Component). Resto do plano implementado como desenhado.

# 022 — Sistema de equipes

## Objetivo

Permitir que **vários usuários** enxerguem, em **somente leitura**, a árvore de metas de um
projeto que não é deles — agrupados numa **equipe**. Equipes são geridas só pelo **admin**
(tela de Configurações). Um projeto pertence a **no máximo 1 equipe**. O acesso concedido pela
equipe é **restrito à tela/API de Metas** — Visão Geral, Timeline, Monitoramento e Integrações
do projeto continuam visíveis só ao dono (e ao admin).

## Contexto e justificativa

- Hoje (spec 009) "escopo" = **dono**: `Scope = {role:"admin"} | {role:"client", userId}`, e
  `ownerWhere`/`goalOwnerWhere` filtram tudo por `project.userId`. Não existe noção de acesso
  compartilhado entre usuários `client`.
- Decisões tomadas com o humano (neste chat, registro CLAUDE.md §1):
  1. **Permissão**: membro de equipe é **somente leitura** nas metas do projeto compartilhado —
     mutação (`POST`/`PATCH`/`DELETE /api/goals*`) **continua exclusiva de `role=admin`**, sem
     mudança nessa regra (PRD §2 já a define; não há exceção para equipe).
  2. **Gestão**: só **admin** cria equipes, adiciona/remove membros e atribui/desatribui
     projetos a uma equipe. Fica na tela **Configurações** (área admin-only), como um novo card
     funcional — não é um módulo novo no menu.
  3. **Escopo do acesso**: **só a tela/API de Metas** passam a considerar a equipe do usuário.
     `listProjects`, `/dashboard/integracoes`, o switcher do header, Visão Geral, Timeline e
     Monitoramento **não mudam** — continuam só-dono (+ admin global).
  4. **Cardinalidade**: 1 projeto → no máx. 1 equipe (campo `teamId` nullable em `Project`); 1
     usuário pode participar de várias equipes.
  5. **Seletor na tela de Metas**: a tela de Metas ganha uma **seção própria e independente**
     ("Metas de equipe") com seu próprio seletor de projeto — não amplia nem reaproveita o
     cookie/seletor do header (`selected_project_id`), que seguem só-dono.

## Impacto em PRD/SPEC (CLAUDE.md §1)

O PRD/SPEC não previam nenhuma forma de acesso compartilhado entre usuários `client`. Esta task
**adiciona** essa capacidade sem contradizer o modelo existente (papéis, mutação admin-only,
projeto = 1 dono seguem intactos). Atualizações:

- **PRD.md**
  - §1 (tabela): não vira um módulo novo do menu (fica dentro de Configurações — decisão 2).
  - §2 (papéis): acrescentar que um usuário `client` pode, além dos seus próprios projetos,
    **visualizar (somente leitura) as metas** de projetos de uma equipe da qual participa;
    equipes são geridas só pelo admin.
  - §4 (Metas): nota de que a leitura de metas é escopada por **dono OU equipe**; mutação segue
    igual (§4 inalterado).
  - §9 (Configurações): acrescentar "Equipes: criar/remover equipes, gerir membros e atribuir
    projetos (1 projeto → no máx. 1 equipe)" à lista do que a tela contém.
  - §12 (decisões): nova linha "Equipes | Grupo de usuários com leitura compartilhada das metas
    de um projeto; só admin gere; 1 projeto → no máx. 1 equipe (spec 022)".
- **SPEC.MD**
  - §2 (modelo de dados): novas tabelas `teams`/`team_members`; `projects` ganha `team_id`
    nullable.
  - §4 (API): novas rotas `/api/teams*` (ver abaixo).
  - §5.1 (leitura de metas): nota de que o `WHERE` de leitura passa a incluir projetos de
    equipe do usuário, mutação inalterada.
  - §11 (segurança): reforço de que a mutação de metas segue admin-only mesmo com acesso de
    equipe.

## Dependência de ordem (CLAUDE.md §5.5)

Depende só da base já pronta (`projects.ts`/`goals/service.ts`, spec 013/016). Não bloqueia nem é
bloqueada por specs em andamento (021 realtime é ortogonal — eventos de equipe **não** entram
nesta task).

## Arquivos a criar / alterar

### Schema
- `prisma/schema.prisma` — `Team`, `TeamMember`; `Project.teamId` (+ relação); `User.teamMemberships`.
- Nova migração via `bunx prisma migrate dev` (gerada na implementação).
- `tests/setup/db.ts` — `truncateAll` ganha `"teams"` na lista (cascateia `team_members` e zera
  `projects.team_id` via `SET NULL`... na verdade `TRUNCATE ... CASCADE` cascateia por FK
  independente do `onDelete`, então incluir `"teams"` já limpa `team_members`; `projects` não é
  apagado, só a FK zera — como `projects` já está na lista, a ordem não importa).

### Criar — `src/lib/teams.ts` (único portão Postgres do domínio de equipes)
- `export interface TeamWithDetails extends Team { members: {userId; email; name; role}[]; projects: {id; name; owner; repo}[] }`
- `listTeams(): Promise<TeamWithDetails[]>` — todas as equipes (admin-only, gate no route).
- `createTeam(name: string): Promise<Team>`.
- `deleteTeam(id: string): Promise<{ok:true}|{ok:false; error:"not_found"}>` — cascade em `team_members`; `projects.teamId` some via `onDelete: SetNull`.
- `addMember(teamId, userId): Promise<{ok:true}|{ok:false; error:"team_not_found"|"user_not_found"|"already_member"}>`.
- `removeMember(teamId, userId): Promise<{ok:true}|{ok:false; error:"not_found"}>`.
- `assignProject(teamId, projectId): Promise<{ok:true}|{ok:false; error:"team_not_found"|"project_not_found"}>` — seta `project.teamId = teamId` (move de outra equipe se já tinha; cardinalidade 1 é sempre respeitada pois é um `UPDATE`, não um vínculo N:N).
- `unassignProject(teamId, projectId): Promise<{ok:true}|{ok:false; error:"not_found"}>` — só limpa se `project.teamId === teamId`.
- `listAssignableUsers(): Promise<{id; email; name; role}[]>` — todos os usuários (p/ o `<select>` do admin).
- `listAssignableProjects(): Promise<{id; name; owner; repo; teamId}[]>` — todos os projetos (escopo admin) p/ o `<select>` de atribuição.
- `listTeamProjectIdsForUser(userId): Promise<string[]>` — ids dos projetos de qualquer equipe de que o usuário participa (dedupe).
- `listTeamProjectsForUser(userId): Promise<Project[]>` — mesma coisa, linhas completas (ordenado por `createdAt asc`, espelha `listProjects`).

### Alterar — `src/lib/goals/service.ts`
- Novo `goalReadWhere(scope): Promise<Prisma.GoalWhereInput>` (**assíncrono**, só p/ leitura):
  admin → `{}`; client sem equipe → `{ project: { userId } }` (igual hoje); client com equipe(s)
  → `{ OR: [{ project: { userId } }, { projectId: { in: teamProjectIds } }] }`.
- `goalOwnerWhere` **não muda** — segue só-dono; usado por `createGoal`/`updateGoal`/
  `archiveGoal`/`linkBranch`/`unlinkBranch`/`linkCommit` (mutação continua bloqueada p/ membro
  de equipe: projeto de equipe não é "seu" → `not_found`).
- `listGoals` e `findGoalIdByShortCode` passam a usar `await goalReadWhere(scope)` no lugar de
  `goalOwnerWhere(scope)`. Efeito colateral aceito e documentado: como `listGoals`/
  `findGoalIdByShortCode` são o **único portão** reusado pelo MCP (`@/lib/mcp/tools` →
  `metas_list`), o **token pessoal do próprio membro** também passa a listar as metas do projeto
  de equipe — é leitura do próprio usuário autenticado, mesma regra do REST/UI, não é escalação
  de privilégio. Mutação via MCP (`metas_create/update/archive/link_*`) segue bloqueada
  (`goalOwnerWhere` inalterado).

### Criar — `src/lib/goals/team-select.ts` (espelha `src/lib/projects/select.ts`)
- `METAS_TEAM_PROJECT_COOKIE = "metas_team_project_id"`.
- `pickTeamProject<T extends {id:string}>(projects: T[], cookieVal?: string): T | null` —
  **puro/unit-testável**: cookie casa `id` → esse; ausente/alheio → 1º da lista (mais antigo);
  lista vazia → `null`. Sem imports de runtime.
- `resolveTeamProjectSelection(userId): Promise<Project | null>` — helper de Server Component:
  `next/headers` (cookie) + `listTeamProjectsForUser(userId)` (imports dinâmicos) + `pickTeamProject`.
- `selectMetasTeamProject(projectId): Promise<void>` (`"use server"`) — valida
  `projectId ∈ listTeamProjectIdsForUser(current.id)` (alheio/inexistente → no-op) e grava o
  cookie (`httpOnly`, `SameSite=Lax`, `path:/`, 1 ano). **Divergência:** implementada em
  `src/lib/goals/team-actions.ts` (arquivo `"use server"` dedicado), não em `team-select.ts`
  — ver "Divergência da implementação" no topo do arquivo.

### Criar — rotas REST (handlers finos, admin-only)
- `src/app/api/teams/route.ts` — `GET` lista (`listTeams`); `POST {name}` cria.
- `src/app/api/teams/[id]/route.ts` — `DELETE` remove a equipe.
- `src/app/api/teams/[id]/members/route.ts` — `POST {userId}` adiciona membro.
- `src/app/api/teams/[id]/members/[userId]/route.ts` — `DELETE` remove membro.
- `src/app/api/teams/[id]/projects/route.ts` — `POST {projectId}` atribui projeto à equipe.
- `src/app/api/teams/[id]/projects/[projectId]/route.ts` — `DELETE` desatribui.
- Todas exigem `requireAdmin()` (`403`/redirect igual às demais rotas admin-only); corpo
  inválido → `400`; `not_found`/variantes → `404`; sucesso → `200`/`201`.

### Criar — UI (admin, dentro de Configurações)
- `src/components/configuracoes/teams-manager.tsx` (`"use client"`) — `TeamsManagerCard`: lista
  equipes (`team-row`), expande uma por vez (membros + projetos), formulário criar equipe
  (`team-name-input`/`team-create`), adicionar/remover membro (`<select>` de
  `listAssignableUsers`, `team-member-add`/`team-member-remove`), atribuir/desatribuir projeto
  (`<select>` de `listAssignableProjects`, `team-project-add`/`team-project-remove`). Reusa
  `CardShell` de `profile-cards.tsx`. Mutações via `fetch` + `router.refresh()`.
- `src/app/dashboard/configuracoes/page.tsx` — carrega `listTeams()` +
  `listAssignableUsers()` + `listAssignableProjects()`, renderiza `<TeamsManagerCard>` como
  bloco full-width abaixo do layout de 2 colunas existente.

### Criar — UI (client, tela de Metas)
- `src/components/metas/team-metas-section.tsx` (`"use client"`) — `TeamMetasSection({
  teamProjects, selectedProjectId, goals })`: some se `teamProjects.length === 0`. Renderiza um
  seletor próprio (`team-project-switcher`/`team-project-option`, espelha `ProjectSwitcher`) que
  chama a Server Action `selectMetasTeamProject` + `router.refresh()`, e abaixo a árvore
  (`<MetasView goals={goals} canMutate={false} />` — **sempre `false`**, não depende do papel do
  usuário renderizando essa seção).
- `src/app/dashboard/metas/page.tsx` — além do fluxo atual (inalterado: `ownProject` via
  `resolveSelectedProject`, `ownGoals` via `listGoals`), se `scope.role === "client"`: carrega
  `teamProjects = await listTeamProjectsForUser(user.id)`, `selectedTeam =
  await resolveTeamProjectSelection(user.id)`, `teamGoals = selectedTeam ? (await
  listGoals(scope, selectedTeam.id)).map(toGoalDTO) : []`, passa a
  `<TeamMetasSection teamProjects selectedProjectId={selectedTeam?.id} goals={teamGoals} />`
  abaixo do `<MetasView>` existente.

### Alterar — testes e2e
- `tests/e2e/seed-teams.ts` (novo, idempotente, espelha `seed-connections.ts`): cria um 2º
  usuário `client` (`equipe@mirantes.live` / `equipe-dev-2026`, nome "Membro Equipe"), cria a
  equipe "Equipe QA", adiciona esse usuário como membro e atribui o projeto **do admin**
  (`devlucasemiliano/mirantes.live`, que já tem metas semeadas por `seed-metas.ts`) à equipe.
- `tests/e2e/global-setup.ts` — chama `bun run tests/e2e/seed-teams.ts` depois de
  `seed-metas.ts` (equipe precisa do projeto + metas já semeados).
- `tests/e2e/teams.spec.ts` (novo).

### DOC.md a criar/atualizar
Criar: `src/app/api/teams/DOC.md`, `[id]/DOC.md`, `[id]/members/DOC.md`, `[id]/members/[userId]/DOC.md`,
`[id]/projects/DOC.md`, `[id]/projects/[projectId]/DOC.md`.
Atualizar: `src/app/api/DOC.md`, `src/lib/DOC.md` (entrada `teams.ts`), `src/lib/goals/DOC.md`
(`goalReadWhere` + `team-select.ts`), `src/app/dashboard/metas/DOC.md`, `src/components/metas/DOC.md`,
`src/app/dashboard/configuracoes/DOC.md`, `src/components/configuracoes/DOC.md`.

---

## Mudanças de schema (`prisma/schema.prisma`)

```prisma
/// Equipe (spec 022): agrupa usuários que compartilham LEITURA das metas de um projeto.
/// Gerida só por admin. 1 projeto pertence a no máx. 1 equipe (Project.teamId).
model Team {
  id        String       @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime     @default(now()) @map("created_at")
  members   TeamMember[]
  projects  Project[]

  @@map("teams")
}

/// Membro de uma equipe (N:N usuário↔equipe). Sem papel próprio dentro da equipe — o
/// vínculo só concede LEITURA de metas; mutação segue exclusiva de role=admin (PRD §2).
model TeamMember {
  id        String   @id @default(uuid()) @db.Uuid
  teamId    String   @map("team_id") @db.Uuid
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now()) @map("created_at")

  @@unique([teamId, userId])
  @@index([userId])
  @@map("team_members")
}
```

Em `User`: `teamMemberships TeamMember[]`.

Em `Project`: `teamId String? @map("team_id") @db.Uuid` + `team Team? @relation(fields: [teamId], references: [id], onDelete: SetNull)` + `@@index([teamId])`.

---

## Desenho dos testes

**Infra real (§5.3):** Postgres real na integração (cria equipe, adiciona/remove membro,
atribui/desatribui projeto, lê metas pelo escopo widened). Nada externo a stubar.
`pickTeamProject` é puro → unit.

**Passo vermelho (§5.4):** antes de implementar, `tests/unit/team-select.test.ts` e
`tests/integration/teams.test.ts` não carregam (`@/lib/goals/team-select` e `@/lib/teams`
inexistentes) → red de import. Mesmo depois de criar os módulos vazios, o caso "membro de
equipe enxerga metas do projeto compartilhado" falha (`listGoals` ainda usa só
`goalOwnerWhere`, sem equipe → array vazio em vez do esperado) até `goalReadWhere` entrar.
**Break-to-confirm**: neutralizar `listTeamProjectIdsForUser` (retornar sempre `[]`) derruba
esse caso de volta ao vermelho sem afetar os demais (isolamento do dono / mutação bloqueada),
provando que o caso realmente exercita o código de equipe.

### Unit — `tests/unit/team-select.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { pickTeamProject } from "@/lib/goals/team-select";

const P = (id: string) => ({ id });

describe("pickTeamProject (puro)", () => {
  it("cookie casa um projeto da lista → esse", () => {
    const projects = [P("a"), P("b")];
    expect(pickTeamProject(projects, "b")).toEqual(P("b"));
  });

  it("cookie ausente/alheio → primeiro da lista (fallback)", () => {
    const projects = [P("a"), P("b")];
    expect(pickTeamProject(projects, undefined)).toEqual(P("a"));
    expect(pickTeamProject(projects, "alheio")).toEqual(P("a"));
  });

  it("lista vazia → null, mesmo com cookie", () => {
    expect(pickTeamProject([], "a")).toBeNull();
  });
});
```

### Integração — `tests/integration/teams.test.ts`

```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addMember,
  assignProject,
  createTeam,
  listTeamProjectIdsForUser,
  removeMember,
  unassignProject,
} from "@/lib/teams";
import {
  archiveGoal,
  createGoal,
  listGoals,
  updateGoal,
} from "@/lib/goals/service";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function ownedProject(email: string) {
  const u = await seedUser({ email, password: "p", role: "client" });
  const p = await createProject({ userId: u.id, name: "P", owner: "o", repo: email.split("@")[0] });
  if (!p.ok) throw new Error("setup");
  return { user: u, project: p.project };
}

it("membro de equipe LÊ as metas do projeto compartilhado; dono continua vendo as suas", async () => {
  const dono = await ownedProject("dono@x.com");
  const membro = await seedUser({ email: "membro@x.com", password: "p", role: "client" });
  await createGoal(ADMIN, { projectId: dono.project.id, title: "meta compartilhada", dueDate: future() });

  // sem equipe ainda: membro não vê nada do projeto do dono
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);

  const team = await createTeam("Equipe QA");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  const seen = await listGoals(asClient(membro.id));
  expect(seen.map((g) => g.title)).toEqual(["meta compartilhada"]);
  // o dono segue vendo a própria (sem duplicar)
  expect(await listGoals(asClient(dono.user.id))).toHaveLength(1);
});

it("membro de equipe NÃO consegue mutar (criar/editar/arquivar) meta do projeto compartilhado", async () => {
  const dono = await ownedProject("dono2@x.com");
  const membro = await seedUser({ email: "membro2@x.com", password: "p", role: "client" });
  const goal = await createGoal(ADMIN, { projectId: dono.project.id, title: "M", dueDate: future() });
  if (!goal.ok) throw new Error("setup");

  const team = await createTeam("Equipe QA 2");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  const create = await createGoal(asClient(membro.id), {
    projectId: dono.project.id,
    title: "tentativa",
    dueDate: future(),
  });
  expect(create).toEqual({ ok: false, error: "not_found" });

  const update = await updateGoal(asClient(membro.id), goal.goal.id, { title: "hack" });
  expect(update).toEqual({ ok: false, error: "not_found" });

  const archive = await archiveGoal(asClient(membro.id), goal.goal.id);
  expect(archive).toEqual({ ok: false, error: "not_found" });
});

it("remover membro ou desatribuir projeto revoga o acesso de leitura", async () => {
  const dono = await ownedProject("dono3@x.com");
  const membro = await seedUser({ email: "membro3@x.com", password: "p", role: "client" });
  await createGoal(ADMIN, { projectId: dono.project.id, title: "M", dueDate: future() });
  const team = await createTeam("Equipe QA 3");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(1);

  await removeMember(team.id, membro.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);

  await addMember(team.id, membro.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(1);
  await unassignProject(team.id, dono.project.id);
  expect(await listGoals(asClient(membro.id))).toHaveLength(0);
});

it("1 projeto → no máx. 1 equipe: atribuir a uma 2ª equipe move (não duplica leitura)", async () => {
  const dono = await ownedProject("dono4@x.com");
  const m1 = await seedUser({ email: "m1@x.com", password: "p", role: "client" });
  const m2 = await seedUser({ email: "m2@x.com", password: "p", role: "client" });
  await createGoal(ADMIN, { projectId: dono.project.id, title: "M", dueDate: future() });
  const teamA = await createTeam("A");
  const teamB = await createTeam("B");
  await addMember(teamA.id, m1.id);
  await addMember(teamB.id, m2.id);
  await assignProject(teamA.id, dono.project.id);
  expect(await listTeamProjectIdsForUser(m1.id)).toEqual([dono.project.id]);

  await assignProject(teamB.id, dono.project.id); // move de A para B
  expect(await listTeamProjectIdsForUser(m1.id)).toEqual([]); // A perdeu
  expect(await listTeamProjectIdsForUser(m2.id)).toEqual([dono.project.id]); // B ganhou
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: dono.project.id } })).teamId,
  ).toBe(teamB.id);
});

it("deletar a equipe libera o projeto (teamId volta a null) e remove os membros", async () => {
  const dono = await ownedProject("dono5@x.com");
  const membro = await seedUser({ email: "membro5@x.com", password: "p", role: "client" });
  const team = await createTeam("Efêmera");
  await addMember(team.id, membro.id);
  await assignProject(team.id, dono.project.id);

  await db.team.delete({ where: { id: team.id } });
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: dono.project.id } })).teamId,
  ).toBeNull();
  expect(await db.teamMember.count({ where: { teamId: team.id } })).toBe(0);
});
```

### E2E — `tests/e2e/teams.spec.ts` (esqueleto; seletores finais na implementação)

Duas jornadas:

1. **Admin gerencia equipe** (`/dashboard/configuracoes`): cria a equipe "Equipe QA" (já existe
   via seed — usar um nome novo para não colidir), adiciona `equipe@mirantes.live` como membro
   via `<select>`, atribui o projeto do admin via `<select>`. Assert: a linha da equipe
   (`team-row`) mostra o membro e o projeto listados.
2. **Membro de equipe vê metas em somente leitura** (`equipe@mirantes.live`, semeado por
   `seed-teams.ts` já como membro da "Equipe QA" com o projeto do admin atribuído):
   login → `/dashboard/metas` → seção "Metas de equipe" (`getByTestId("team-project-switcher")`)
   visível, mostrando o projeto do admin → a árvore de metas aparece (mesmos títulos semeados por
   `seed-metas.ts`) **sem** nenhum controle de mutação (nenhum botão "Arquivar"/edição visível
   nessa seção — assert de ausência). As **metas próprias** do membro (se houver) continuam na
   seção de cima, inalterada.

## Critérios de pronto

- [x] `tests/unit/team-select.test.ts` + `tests/integration/teams.test.ts` verdes (vistos
      vermelhos antes: import inexistente, depois `listGoals` sem equipe; break-to-confirm em
      `listTeamProjectIdsForUser` neutralizado confirma que o caso de leitura compartilhada
      exercita o código novo).
- [x] `tests/e2e/teams.spec.ts` verde (2/2).
- [x] Migração Prisma aplicada (`Team`/`TeamMember`/`Project.teamId`); `prisma generate` ok.
- [x] Mutação de metas (`create`/`update`/`archive`/`link*`) confirmadamente **bloqueada** p/
      membro de equipe em projeto não-próprio (mesmo teste de integração cobre isso).
- [x] Escopo fora de Metas (projetos/timeline/monitoramento/visão geral) **inalterado** — sem
      teste que passe a exigir acesso de equipe ali (é o "não fazer" desta task).
- [x] `bun run typecheck` limpo; Biome limpo nos arquivos da task.
- [x] `DOC.md` atualizados (lista acima).
- [x] `PRD.md`/`SPEC.MD` atualizados conforme "Impacto em PRD/SPEC".
- [x] Spec marcada `done` (atualizada com a divergência do `team-actions.ts`).
- [x] Suíte completa (`bun run test`): 233/233 testes verdes, 40 arquivos.

## Fora de escopo (follow-ups)

- Eventos/realtime de equipe (ex. "fulano entrou na equipe X") na Timeline/SSE.
- Papel dentro da equipe (ex. "líder de equipe" que também gerencia membros) — hoje só admin.
- Equipe com acesso de **escrita** às metas — decisão explícita do humano foi somente leitura.
- Ampliar o acesso de equipe p/ Timeline/Monitoramento/Visão Geral — decisão explícita foi só Metas.
- N:N projeto↔equipe (múltiplas equipes por projeto) — decisão explícita foi 1 projeto → no máx. 1 equipe.
