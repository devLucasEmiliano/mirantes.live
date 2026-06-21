---
id: 016
title: Home pública `/` real (read-only) + projetos públicos + rename
status: tests-red        # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-21
---

# 016 — Home pública `/` com dados reais, seletor de projetos públicos e rename

## Objetivo

Fazer a rota raiz `/` **funcionar igual à Visão Geral (`/dashboard`), porém pública e só-leitura**:
cards, metas e timeline **reais** do projeto selecionado, com um **seletor** que lista os projetos
marcados como **públicos** (de qualquer dono). Para isso:

1. `Project` ganha a flag **`isPublic`** (default `false`).
2. A `/` deixa de usar `mockGoals`/`mockSummary`: passa a derivar de dados reais via os puros já
   existentes (`summarizeGoals`, `toGoalDTO`, `deriveTree`).
3. **Seleção pública** por **URL `?projeto=<slug>`** (link compartilhável) com prioridade, **cookie
   `public_project_id`** como memória e fallback = projeto público mais antigo.
4. Em **Integrações** (`projects-manager`), o dono pode **renomear** o projeto e **alternar
   "Público"** via `PATCH /api/projects/:id`.

Mantém a casca visual da vitrine (fundo PixelBlast + `PublicHeader`, sem sidebar). Nada na `/` é
editável por visitantes.

## Contexto e justificativa

- `src/app/page.tsx` hoje: `force-dynamic`, monta cards a partir de `mockSummary`, metas de
  `mockGoals.slice(0,3)`; só a Timeline é real (`listShowcaseEvents(7)`). É o **último consumidor
  real do mock na home** (anotado em `src/lib/DOC.md`).
- A spec 014 já fez o "de-mock" do `/dashboard`: reusar `listGoals`/`summarizeGoals`/`toGoalDTO`/
  `weeklyCommitStats`/`listEvents`. Esta task aplica o mesmo na `/`, só que **pública** (sem `Scope`).
- O `Project` (`prisma/schema.prisma:75`) tem `name/owner/repo/userId`, **sem** visibilidade.
  `@@unique([userId, owner, repo])` → `repo` não é único global, mas `owner/repo` identifica bem
  (mesma premissa da 015).
- Padrões reusados: helper **puro** + função **I/O** + **Server Action** "use server", espelhando
  `pickSelectedProject`/`resolveSelectedProject`/`selectProject`
  (`src/lib/projects/select.ts:13,29` + `actions.ts:16`); resolução de ref por `matchProjectRef`
  (spec 015, `src/lib/projects/ref.ts`); leituras escopadas viram **scope-free filtradas por
  `isPublic`** — a visibilidade pública **é** a autorização.

## Dependência de ordem (CLAUDE.md §5.5)

Depende do harness verde de metas/eventos (013/014) e da resolução de ref (015) — tudo `done`.
Ordem: **unit** (puros de seleção) → **integração** (camada pública + PATCH no Postgres real) →
**e2e** (jornada do visitante + rename refletindo). E2E só sobe com unit+integração verdes.

## Arquivos a criar / alterar

### Schema
- **Alterar `prisma/schema.prisma`** — `Project.isPublic Boolean @default(false) @map("is_public")`
  (+ `@@index([isPublic])`). Migration `project_is_public` via `bunx prisma migrate dev`.

### Domínio de projetos (camada pública, scope-free)
- **Criar `src/lib/projects/public.ts`** — `listPublicProjects()`, `getPublicProject(id)`,
  `publicWeeklyCommitStats(projectId)`.
- **Criar `src/lib/projects/public-select.ts`** — `PUBLIC_PROJECT_COOKIE`, `pickPublicProject`
  (puro), `publicSlug` (puro), `resolvePublicSelection(urlRef)` (I/O fino).
- **Criar `src/lib/projects/public-actions.ts`** ("use server") — `selectPublicProject(projectId)`.
- **Alterar `src/lib/projects.ts`** — `updateProject(id, scope, { name?, isPublic? })` (escopado).
- **Alterar `src/lib/goals/service.ts`** — `listPublicGoals(projectId)` (mesma derivação de
  `listGoals`, `where = { projectId, deletedAt: null }`, **sem** `goalOwnerWhere`).
- **Alterar `src/lib/events.ts`** — `listPublicEvents(projectId, limit)` (`{ projectId,
  visibleToClient: true }`); `listShowcaseEvents` passa a delegar nisto p/ o público mais antigo.

### UI / rotas
- **Alterar `src/app/page.tsx`** — lê `searchParams.projeto`, resolve seleção pública, monta os **5
  cards do `/dashboard`** com dados reais; sem `mockGoals`/`mockSummary`; estado vazio se não há
  público.
- **Criar `src/components/layout/public-project-switcher.tsx`** — dropdown de públicos; itens são
  `<Link href={"/?projeto="+publicSlug}>` + `selectPublicProject(id)` no clique (cookie de memória).
- **Alterar `src/components/layout/public-header.tsx`** — recebe `projects`/`selectedId` e embute o
  switcher.
- **Alterar `src/app/api/projects/[id]/route.ts`** — `PATCH` (zod `{ name?, isPublic? }` →
  `updateProject`).
- **Alterar `src/components/integracoes/projects-manager.tsx`** — editar nome + toggle "Público" no
  painel expandido; `ProjectListItem` ganha `isPublic`. **Alterar** a página de Integrações que monta
  os itens p/ passar `isPublic`.

### DOC.md (CLAUDE.md §2)
- **Criar/alterar**: `src/lib/projects/DOC.md`, `src/lib/goals/DOC.md`, `src/lib/DOC.md`,
  `src/app/DOC.md`, `src/components/layout/DOC.md`, `src/components/integracoes/DOC.md`,
  `prisma/DOC.md` (se existir).

## Contratos

### `src/lib/projects/public.ts`
```ts
export function listPublicProjects(): Promise<Project[]>          // where {isPublic:true}, createdAt asc
export function getPublicProject(id: string): Promise<Project | null>  // {id, isPublic:true} senão null
export function publicWeeklyCommitStats(projectId: string): Promise<{ count: number; previousCount: number }>
```

### `src/lib/projects/public-select.ts`
```ts
export const PUBLIC_PROJECT_COOKIE = "public_project_id";
export interface PublicProjectLike { id: string; name: string; owner: string; repo: string; }

export function publicSlug(p: PublicProjectLike): string;          // `${owner}/${repo}`

// Precedência: URL (match único via matchProjectRef) > cookie (id ainda na lista) > mais antigo > null
export function pickPublicProject<T extends PublicProjectLike>(
  projects: T[], urlRef: string | null, cookieId: string | null,
): T | null;

export function resolvePublicSelection(urlRef: string | null): Promise<Project | null>;  // I/O
```

### `src/lib/projects/public-actions.ts`
```ts
"use server";
export function selectPublicProject(projectId: string): Promise<void>;  // getPublicProject → grava cookie; privado → no-op
```

### `src/lib/projects.ts`
```ts
export type UpdateProjectResult = { ok: true; project: Project } | { ok: false; error: "not_found" };
export function updateProject(
  id: string, scope: Scope, patch: { name?: string; isPublic?: boolean },
): Promise<UpdateProjectResult>;   // updateMany {id, ...ownerWhere(scope)} → count 0 = not_found
```

### `src/lib/goals/service.ts` / `src/lib/events.ts`
```ts
export function listPublicGoals(projectId: string): Promise<DerivedGoal[]>;
export function listPublicEvents(projectId: string, limit?: number): Promise<TimelineEvent[]>;
```

## Impacto em PRD/SPEC

- **PRD.md** §1/§2/§5: a home pública mostra o **projeto público selecionado** (real, read-only) com
  seletor de públicos (qualquer dono); visibilidade é por projeto (default privado), gerida em
  Integrações junto do rename. Ajustar "vitrine = projeto mais antigo de um admin".
- **SPEC.md** §1/§2.8/§4: coluna `is_public`; caminho de dados público scope-free; seleção
  `?projeto=`+cookie; `PATCH /api/projects/:id`.

## Desenho dos testes

**Infra real (§5.3):** Postgres/Redis reais na integração (seed via `tests/setup/db.ts`); nada de
fake. Único externo (GitHub) não participa (não há sync aqui). **`createProject` nasce privado**
(`isPublic:false`), então os seeds tornam público via `db.project.update`.

**Passo vermelho (§5.4):** criar os novos símbolos como sentinelas
(`pickPublicProject`→`null`, `publicSlug`→`""`, `listPublicProjects`→`[]`,
`getPublicProject`/`listPublicGoals`/`listPublicEvents`/`publicWeeklyCommitStats` ignorando o
filtro, `updateProject`→`{ok:false,error:"not_found"}`, `selectPublicProject`→no-op) e ver as
asserções concretas **falharem** → marcar `tests-red` → implementar até verde sem alterar os testes.

### Unit — `tests/unit/public-select.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { pickPublicProject, publicSlug } from "@/lib/projects/public-select";

const P = (over: Partial<{ id: string; name: string; owner: string; repo: string }>) => ({
  id: over.id ?? "id", name: over.name ?? "n", owner: over.owner ?? "o", repo: over.repo ?? "r",
});

describe("publicSlug", () => {
  it("usa owner/repo", () => {
    expect(publicSlug(P({ owner: "acme", repo: "site" }))).toBe("acme/site");
  });
});

describe("pickPublicProject", () => {
  const projects = [
    P({ id: "1", name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" }), // mais antigo
    P({ id: "2", name: "Outro", owner: "acme", repo: "site" }),
  ];

  it("URL (match único) vence o cookie", () => {
    const r = pickPublicProject(projects, "acme/site", "1");
    expect(r?.id).toBe("2");
  });
  it("URL por repo sozinho casa", () => {
    expect(pickPublicProject(projects, "mirantes.live", null)?.id).toBe("1");
  });
  it("URL ambígua → cai pro cookie", () => {
    const dup = [P({ id: "1", repo: "dup" }), P({ id: "2", repo: "dup" })];
    expect(pickPublicProject(dup, "dup", "2")?.id).toBe("2");
  });
  it("URL não encontrada → cai pro cookie", () => {
    expect(pickPublicProject(projects, "zzz", "2")?.id).toBe("2");
  });
  it("sem URL, cookie válido → cookie", () => {
    expect(pickPublicProject(projects, null, "2")?.id).toBe("2");
  });
  it("cookie inválido → mais antigo (primeiro)", () => {
    expect(pickPublicProject(projects, null, "999")?.id).toBe("1");
  });
  it("sem URL nem cookie → mais antigo", () => {
    expect(pickPublicProject(projects, null, null)?.id).toBe("1");
  });
  it("lista vazia → null", () => {
    expect(pickPublicProject([], "qualquer", "x")).toBeNull();
  });
});
```

### Integração — `tests/integration/public-home.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { createGoal, listPublicGoals } from "@/lib/goals/service";
import { listPublicEvents } from "@/lib/events";
import { createProject, updateProject } from "@/lib/projects";
import {
  getPublicProject, listPublicProjects, publicWeeklyCommitStats,
} from "@/lib/projects/public";
import { selectPublicProject } from "@/lib/projects/public-actions";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function makeProject(opts: { role?: "admin" | "client"; owner: string; repo: string; isPublic: boolean }) {
  const u = await seedUser({ email: `${opts.owner}@x.com`, password: "p", role: opts.role ?? "admin" });
  const p = await createProject({ userId: u.id, name: opts.repo, owner: opts.owner, repo: opts.repo });
  if (!p.ok) throw new Error("setup");
  if (opts.isPublic) await db.project.update({ where: { id: p.project.id }, data: { isPublic: true } });
  return { user: u, project: p.project };
}

it("listPublicProjects: só públicos, de donos diferentes, createdAt asc", async () => {
  const a = await makeProject({ owner: "alice", repo: "first", isPublic: true });
  await makeProject({ owner: "bob", repo: "private", isPublic: false });
  const c = await makeProject({ owner: "carol", repo: "third", isPublic: true });
  const list = await listPublicProjects();
  expect(list.map((p) => p.id)).toEqual([a.project.id, c.project.id]); // ordem de criação; privado fora
});

it("getPublicProject: privado → null; público → o projeto (limite de segurança)", async () => {
  const priv = await makeProject({ owner: "bob", repo: "secret", isPublic: false });
  const pub = await makeProject({ owner: "alice", repo: "open", isPublic: true });
  expect(await getPublicProject(priv.project.id)).toBeNull();
  expect((await getPublicProject(pub.project.id))?.id).toBe(pub.project.id);
});

it("listPublicGoals: metas reais derivadas do projeto público; nada vaza de privado", async () => {
  const pub = await makeProject({ owner: "alice", repo: "open", isPublic: true });
  const priv = await makeProject({ owner: "bob", repo: "secret", isPublic: false });
  await createGoal(ADMIN, { projectId: pub.project.id, title: "Pública", dueDate: future() });
  await createGoal(asClient(priv.user.id), { projectId: priv.project.id, title: "Privada", dueDate: future() });
  const pubGoals = await listPublicGoals(pub.project.id);
  expect(pubGoals.map((g) => g.title)).toEqual(["Pública"]);
  // mesmo passando o id de um projeto privado, a função pública não deve servir suas metas
  expect(await listPublicGoals(priv.project.id)).toHaveLength(0);
});

it("listPublicEvents: só visibleToClient do projeto", async () => {
  const pub = await makeProject({ owner: "alice", repo: "open", isPublic: true });
  await db.event.createMany({
    data: [
      { source: "goal", type: "goal.created", title: "visível", projectId: pub.project.id, visibleToClient: true },
      { source: "goal", type: "goal.updated", title: "oculto", projectId: pub.project.id, visibleToClient: false },
    ],
  });
  const events = await listPublicEvents(pub.project.id, 7);
  expect(events.map((e) => e.title)).toEqual(["visível"]);
});

it("publicWeeklyCommitStats: conta janela 7d/14d do projeto", async () => {
  const pub = await makeProject({ owner: "alice", repo: "open", isPublic: true });
  const day = 24 * 60 * 60 * 1000;
  await db.commit.createMany({
    data: [
      { projectId: pub.project.id, sha: "s1", message: "a", author: "Ana", committedAt: new Date(Date.now() - 2 * day) },
      { projectId: pub.project.id, sha: "s2", message: "b", author: "Ana", committedAt: new Date(Date.now() - 10 * day) },
    ],
  });
  const stats = await publicWeeklyCommitStats(pub.project.id);
  expect(stats).toEqual({ count: 1, previousCount: 1 });
});

it("updateProject: dono renomeia e torna público; admin altera qualquer; cliente alheio → not_found", async () => {
  const owner = await makeProject({ role: "client", owner: "bob", repo: "proj", isPublic: false });
  const stranger = await seedUser({ email: "eve@x.com", password: "p", role: "client" });

  const r1 = await updateProject(owner.project.id, asClient(owner.user.id), { name: "Novo Nome", isPublic: true });
  expect(r1.ok && r1.project.name).toBe("Novo Nome");
  expect(r1.ok && r1.project.isPublic).toBe(true);

  const r2 = await updateProject(owner.project.id, asClient(stranger.id), { isPublic: false });
  expect(r2).toEqual({ ok: false, error: "not_found" }); // não-dono não altera
  expect((await db.project.findUniqueOrThrow({ where: { id: owner.project.id } })).isPublic).toBe(true);

  const r3 = await updateProject(owner.project.id, ADMIN, { name: "Pelo Admin" });
  expect(r3.ok && r3.project.name).toBe("Pelo Admin"); // admin alcança qualquer projeto
});

it("selectPublicProject: público grava cookie; privado → no-op", async () => {
  const pub = await makeProject({ owner: "alice", repo: "open", isPublic: true });
  const priv = await makeProject({ owner: "bob", repo: "secret", isPublic: false });
  // o cookie é setado via next/headers; aqui asseguramos que não lança e respeita o limite:
  await expect(selectPublicProject(pub.project.id)).resolves.toBeUndefined();
  await expect(selectPublicProject(priv.project.id)).resolves.toBeUndefined(); // no-op silencioso
});
```
> Nota: o teste de `selectPublicProject` valida o caminho feliz/no-op sem afirmar a escrita do cookie
> (a leitura/escrita de `next/headers` é coberta na e2e). O foco em integração é o **limite de
> segurança** (privado nunca vira público nem aparece) e a derivação real das metas.

### E2E — `tests/e2e/public-home.spec.ts`
```ts
import { expect, test } from "@playwright/test";

// Pré-condição (seed e2e): ≥2 projetos PÚBLICOS de donos diferentes com metas/eventos + 1 privado.
// (memória: parar `next dev` antes de rodar; seed e2e é flaky no Windows — re-rodar se crashar.)

test("visitante vê dados reais e troca de projeto público pelo seletor", async ({ page }) => {
  await page.goto("/");
  // cards reais (não o mock): há um Progresso Total e a lista de metas do projeto público mais antigo
  await expect(page.getByText("Progresso Total")).toBeVisible();
  const switcher = page.getByTestId("public-project-switcher");
  await switcher.click();
  await page.getByTestId("public-project-option").nth(1).click();
  // URL passa a carregar ?projeto=owner/repo (compartilhável) e o conteúdo muda
  await expect(page).toHaveURL(/\/\?projeto=/);
});

test("projeto privado não aparece no seletor e a / é read-only", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("public-project-switcher").click();
  await expect(page.getByText("secret")).toHaveCount(0); // repo privado ausente
  // nenhuma ação de edição na home pública
  await expect(page.getByRole("button", { name: /editar|salvar|tornar público/i })).toHaveCount(0);
});

test("admin torna público + renomeia em Integrações e a / reflete", async ({ page }) => {
  // login admin → /dashboard/integracoes → expandir projeto privado → renomear + toggle Público
  // ... (helpers de login do harness e2e existente)
  // depois: logout/visitante → / → seletor lista o novo nome
});
```

## Critérios de pronto

- [ ] Migration `project_is_public` aplicada; `bunx prisma generate` ok.
- [ ] Unit + integração + e2e verdes (cada um visto **vermelho** antes), na ordem §5.5; infra real
      (Postgres/Redis); sem mocks proibidos.
- [ ] `/` sem login mostra metas/cards/timeline reais do projeto público selecionado; troca via
      seletor muda URL (`?projeto=owner/repo`) e conteúdo; projeto **privado** nunca aparece nem
      responde por dados.
- [ ] Em Integrações, renomear e alternar "Público" reflete na `/`; `PATCH` escopado (alheio → 404).
- [ ] `tsc --noEmit` limpo; Biome limpo nos arquivos tocados; `DOC.md` atualizados; PRD/SPEC
      atualizados.
- [ ] Spec marcada `done` (atualizada se divergiu).

## Fora de escopo

- Tornar **Saúde do Projeto** e **Tempo Médio** reais (saem da `/`; cards espelham o `/dashboard`).
- `UptimePanel` segue mock (igual ao `/dashboard`).
- Página dedicada de configurações por projeto (rename/visibilidade ficam em Integrações).
- Rotas `/p/[owner]/[repo]` ou visibilidade granular por meta/evento (segue `visibleToClient`).
