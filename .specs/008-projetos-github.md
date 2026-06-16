---
id: 008
title: Projetos — fundação multi-projeto + sync GitHub (commits/Actions/branches)
status: done        # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-16
---

# 008 — Projetos: fundação multi-projeto + sync GitHub

## Objetivo

Introduzir a entidade **`Project` = exatamente 1 repositório GitHub** como **raiz do domínio** e:

1. **Puxar e persistir** do repo de cada projeto: **commits**, **branches**, **workflow runs
   (Actions)** e **nome/branch padrão**. Sync idempotente (`createMany skipDuplicates` p/ commits;
   `upsert` p/ branches/runs; remoção de branches sumidas; avanço de cursor
   `lastSeenSha`/`lastPolledAt`).
2. **Disparo do sync:** botão admin (`POST /api/projects/:id/sync`) **e** worker de polling
   (`bun run src/lib/github/worker.ts`) — ambos sobre o **mesmo** núcleo `syncProject(projectId, client?)`.
3. **UI em Configurações:** o `ProjectCard` (hoje mock) vira funcional — lista projetos, adiciona
   (owner/repo), remove, sincroniza, e ao expandir mostra o **log de atividade** do projeto (commits
   recentes + branches + status do último run de CI).
4. **Consumo no app:** `ProjectSwitcher` mostra o **nome real**; a Visão Geral ganha **"Commits da
   Semana"** real + bloco **"último commit"**.
5. **Documentar a raiz:** PRD/SPEC passam a multi-projeto e declaram que `goals`/`services`/`events`
   receberão `project_id` nas suas specs (sem construí-las aqui).

## Contexto e justificativa

- Hoje só **auth + perfil** são reais (specs 003/007); `metas`/`timeline`/`monitoramento`/`projetos`
  são **mock** (`src/lib/mock-data.ts`). `env.GITHUB_PAT` já é validado (opcional) mas **não é usado**.
- O commit `a646f4b` **apagou** um rascunho `008-projetos.md` (719 linhas; `git show --stat` confirma
  que **nenhum código** foi adicionado — a mensagem "implement multi-project support" era aspiracional).
  Partimos do zero no domínio de Projetos, reaproveitando o **schema + algoritmo de sync** validados
  naquele rascunho, mas **descartando** o que o tornava pesado (seção `/dashboard/projetos` no menu e a
  realocação do Monitoramento).
- A visão do humano é **Projeto como raiz** ("cada projeto tem suas metas, atividades = commits,
  progresso e quedas"). Como metas/timeline/monitoramento **ainda não existem** como features reais,
  **não dá** para scopá-las por projeto antes de existirem (CLAUDE.md §5.5). Por isso esta spec é a
  **fundação**: cria `Project` + dados do GitHub + log de atividade em Configurações + Switcher real,
  e deixa schema/documentação prontos para as futuras tabelas pendurarem em `project_id`.
- Multi-projeto **contraria o PRD atual** (single-project) → CLAUDE.md §1 exige **atualizar PRD/SPEC**
  na mesma task. `Actions` + `branches` **não constam** no SPEC (só commits) → SPEC §2.8/§7 é estendido.

> **Documentos-fonte:** `.docs/PRD.md` e `.docs/SPEC.MD` (não na raiz).
> **Tooling (CLAUDE.md §0):** **Bun** é gerenciador **e** runtime — `bun install`, `bunx <bin>`,
> `bun run <script>`. **Nunca `npm`/`npx`/`yarn`/`pnpm`.**

## Dependência de ordem (CLAUDE.md §5.5)

Depende do **harness de testes da spec 007** (Vitest + Playwright + Postgres `mirantes_test`) já
**verde**. É a 1ª spec a criar tabelas de domínio além de auth/perfil.

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

1. **Onde vive:** gerência (add/remover/sincronizar/listar/expandir) em **`/dashboard/configuracoes`**,
   ligando o `ProjectCard` mock. **Sem** seção nova no menu, **sem** página `/dashboard/projetos`.
2. **Persistência:** dados do GitHub **gravados no Postgres** (`Project`/`Commit`/`Branch`/
   `WorkflowRun`), com sync idempotente + dedupe por SHA.
3. **Sync:** **botão manual** ("Sincronizar Agora") **+ worker de polling** de fundo (`worker:github`),
   ambos sobre o mesmo `syncProject`.
4. **Monitoramento:** **não** mexer agora (segue mock/global). Realocação por-projeto = spec futura.
5. **Recorte = fundação + log de atividade + consumidores na Visão Geral.** Re-cabear o **Switcher**
   (nome real) e adicionar na Visão Geral um **"Commits da Semana"** real + um bloco **"último commit"**.
   O resto da Visão Geral (metas/saúde) segue mock até suas specs.

## Fora de escopo (specs futuras)

- Metas por projeto; Timeline/eventos/SSE (`events`, `PUBLISH`, `/api/stream`) — só deixar o
  `// TODO(spec-timeline)` em `sync.ts`.
- Monitoramento real e realocação por-projeto (`services.project_id`, `service_checks`, `incidents`,
  probes HTTP/Docker, uptime/saúde). `services` segue **global/mock**.
- Troca de contexto real do Switcher (dropdown que filtra o app). Aqui só exibe o nome real.
- Octokit / libs novas (usar `fetch` nativo — §0). Rate-limit do sync. Teste do `worker.ts` (fino;
  o núcleo coberto é `syncProject`).

---

## Arquivos a criar / alterar

### Schema, seed, migração
- **Alterar** `prisma/schema.prisma` — modelos `Project`, `Commit`, `Branch`, `WorkflowRun` (abaixo).
- **Migração** `bunx prisma migrate dev --name projects_github` **seguida de** `bunx prisma generate`
  (Prisma 7 não gera o client junto da migração — ver nota da spec 007).
- **Alterar** `prisma/seed.ts` — `upsert` idempotente de 1 projeto dev por `@@unique([owner, repo])`:
  `{ name: "Mirantes.Live Dashboard", owner: "devlucasemiliano", repo: "mirantes.live" }`. **Sem**
  commits/runs (vêm do sync/fixtures).

### Camada GitHub (NOVA) — `src/lib/github/`
- **`client.ts`** — único ponto HTTP com o GitHub (`fetch` nativo + `env.GITHUB_PAT`; **sem Octokit**).
  Tipos `GhCommit`/`GhBranch`/`GhWorkflowRun`, interface injetável `GitHubClient`,
  `createGitHubClient(token = env.GITHUB_PAT): GitHubClient | null` (**null** se não há PAT),
  `class GitHubError`. **Nunca** loga/expõe o PAT (SPEC §7/§11).
  - `getRepo({owner,repo}) → { name, defaultBranch }` (`GET /repos/{o}/{r}`).
  - `listCommits({owner,repo,since?,sha?,perPage?})` (`GET /repos/{o}/{r}/commits`).
  - `listBranches({owner,repo,perPage?})` (`GET /repos/{o}/{r}/branches`).
  - `listWorkflowRuns({owner,repo,perPage?})` (`GET /repos/{o}/{r}/actions/runs`, envelope
    `{ workflow_runs }`).
- **`map.ts`** (puro, unit-testável) — `mapCommit`, `summarizeCommitBatch`, `deriveRunStatus`,
  `isValidRepoSlug`, `formatWeeklyDelta`.
- **`sync.ts`** — `syncProject(projectId, client?)` (algoritmo abaixo). No retorno de sucesso, deixar
  `// TODO(spec-timeline): emitir evento commit.batch + PUBLISH goals:updates`.
- **`worker.ts`** (fino, **fora** de `test_levels`) — `runGitHubSyncLoop({ intervalMs })` itera
  `db.project.findMany` chamando `syncProject`, loga só `inserted` (nunca o PAT), sobrevive a erro
  por-projeto, encerra em SIGINT/SIGTERM. Rodado por `bun run src/lib/github/worker.ts`.

### Camada de projetos / summary (NOVA)
- **`src/lib/projects.ts`** — `createProject`/`listProjects`/`getProject`/`deleteProject` (retornos
  discriminados; ver testes) + **consumidores**:
  - `weeklyCommitStats(): Promise<{ count: number; previousCount: number }>` — `count(commits)` na
    janela de 7d e na janela 7–14d anteriores (global, todos os projetos — PRD §5).
  - `latestCommit(): Promise<{ sha; message; author; committedAt; projectName } | null>`.

### Endpoints (handlers finos, padrão `auth/password/route.ts`)
- **`src/app/api/projects/route.ts`** — `GET` (auth → `listProjects`) + `POST` (admin → `createProject`).
- **`src/app/api/projects/[id]/route.ts`** — `GET` (auth → `getProject`, 404) + `DELETE` (admin →
  `deleteProject`).
- **`src/app/api/projects/[id]/sync/route.ts`** — `POST` (admin → `syncProject`; mapeia
  `no_token`→**409**, `project_not_found`→**404**, `github_error`→**502**, `ok`→**200**).
- Regra: `getCurrentUser()` (401) → não-admin em mutação → **403** → zod (400) → serviço → HTTP.
  DTO serializa `WorkflowRun.runId` com `String(...)` (BigInt não é JSON-safe).

### Frontend
- **`src/app/dashboard/configuracoes/page.tsx`** — após `requireAdmin()`, buscar `listProjects()` e o
  booleano `hasToken = Boolean(env.GITHUB_PAT)`; passar a um novo client component.
- **`src/components/configuracoes/projects-manager.tsx`** (NOVO, `"use client"`) — substitui o
  `ProjectCard` mock. Reusa `CardShell`/`ReadOnlyField` de `profile-cards.tsx`. Funções:
  - **Listar** projetos; expandir/recolher um por vez (estado local, ícone `ChevronDown/Right`).
  - **Adicionar**: form (Nome opcional, Owner, Repositório) → `POST /api/projects` → trata
    200/400/403/409 → `router.refresh()`. Valida slug no client antes (espelha `isValidRepoSlug`).
  - **Sincronizar**: "Sincronizar Agora" → `POST /api/projects/:id/sync` → trata 200/409
    (`no_token` → "Configure o GITHUB_PAT no servidor")/404/502 → `router.refresh()`.
  - **Remover**: `DELETE /api/projects/:id` → `router.refresh()`.
  - **Log de atividade** (ao expandir): commits recentes (sha curto/mensagem/autor/quando), branches
    (com a `default` marcada), e o status do último workflow run (badge via `deriveRunStatus`).
  - Badge de conexão reflete `hasToken` + `lastPolledAt` (Conectado / Sem PAT / Nunca sincronizado).
  - `data-testid`: `project-row`, `add-project-owner`/`add-project-repo`, `sync-now`, `commit-row`,
    `branch-row`.
- **Alterar** `src/components/configuracoes/profile-cards.tsx` — **remover** o `ProjectCard` mock (e
  imports mortos: `ChevronDown/ChevronRight/GitBranch/Plus/RefreshCw` se não usados); manter
  `CardShell`/`ReadOnlyField` (agora reusados por `projects-manager`).
- **Alterar** `src/components/layout/project-switcher.tsx` + `src/components/layout/app-header.tsx` —
  o `AppHeader` (server) busca o nome do projeto raiz (`db.project.findFirst({ orderBy:{createdAt} }`)
  e passa por prop; `ProjectSwitcher` deixa de importar `mockProject`. Sem projetos → fallback
  "Nenhum projeto". (Sem dropdown de troca — fora de escopo.)
- **Alterar** `src/app/dashboard/page.tsx` (server) — chamar `weeklyCommitStats()` + `latestCommit()`;
  adicionar um **`StatCard` "Commits da Semana"** (contagem real + `formatWeeklyDelta`) à linha de
  cards, e um bloco **"último commit sincronizado"** na coluna direita (acima do `TimelineFeed`).
  Resto segue `mockSummary`/`mockGoals`/`mockEvents`.
- **Alterar** `src/lib/mock-data.ts` — remover `mockProject` (sem uso após o Switcher real); manter o
  restante. `weeklyCommits`/`weeklyCommitsDelta` de `mockSummary` deixam de ser lidos (a Visão Geral
  usa os reais).

### Harness de testes (reusa o da 007)
- **Alterar** `tests/setup/db.ts` — `truncateAll()` inclui `projects` (CASCADE limpa
  commits/branches/workflow_runs).
- **Criar** `tests/setup/github.ts` — `makeStubClient(...)` + fixtures `ghCommit`/`ghBranch`/`ghRun`.
- **Criar** `tests/unit/github-map.test.ts`, `tests/unit/summary.test.ts`,
  `tests/integration/sync.test.ts`, `tests/integration/projects.test.ts`,
  `tests/e2e/configuracoes-projetos.spec.ts`.
- **Alterar** `tests/e2e/global-setup.ts` — após `migrate deploy` + `db seed`, inserir
  commits/branches/runs idempotentes (`createMany skipDuplicates`) p/ o projeto dev (e2e determinístico).
- **Alterar** `package.json` — script `"worker:github": "bun run src/lib/github/worker.ts"`.

---

## Mudanças de schema (`prisma/schema.prisma`)

```prisma
/// Um Projeto = exatamente 1 repositório GitHub. Raiz do domínio: metas/serviços/eventos
/// receberão project_id nas suas specs. Dobra a antiga `repos` do SPEC §2.8.
model Project {
  id            String        @id @default(uuid()) @db.Uuid
  name          String
  owner         String
  repo          String
  description   String?
  defaultBranch String?       @map("default_branch")
  lastPolledAt  DateTime?     @map("last_polled_at")
  lastSeenSha   String?       @map("last_seen_sha")
  createdAt     DateTime      @default(now()) @map("created_at")
  commits       Commit[]
  branches      Branch[]
  workflowRuns  WorkflowRun[]

  @@unique([owner, repo])
  @@map("projects")
}

model Commit {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sha         String
  message     String                                  // subject (1ª linha)
  author      String
  committedAt DateTime @map("committed_at")
  createdAt   DateTime @default(now()) @map("created_at")

  @@unique([projectId, sha])                          // chave de dedupe do sync
  @@index([projectId, committedAt])                   // janela semanal (weeklyCommitStats)
  @@map("commits")
}

model Branch {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  commitSha String   @map("commit_sha")
  isDefault Boolean  @default(false) @map("is_default")
  updatedAt DateTime @updatedAt @map("updated_at")     // toque local do sync

  @@unique([projectId, name])
  @@map("branches")
}

model WorkflowRun {
  id           String    @id @default(uuid()) @db.Uuid
  projectId    String    @map("project_id") @db.Uuid
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  runId        BigInt    @map("run_id")                // id numérico do GitHub (estoura int32)
  name         String
  headBranch   String?   @map("head_branch")
  headSha      String    @map("head_sha")
  status       String                                  // queued|in_progress|completed
  conclusion   String?                                 // success|failure|cancelled|null
  runNumber    Int       @map("run_number")
  htmlUrl      String    @map("html_url")
  runStartedAt DateTime? @map("run_started_at")
  updatedAt    DateTime  @map("updated_at")            // updated_at do GitHub (dado, não @updatedAt)

  @@unique([projectId, runId])
  @@index([projectId, runStartedAt])
  @@map("workflow_runs")
}
```

### `syncProject` — algoritmo (idempotente)

`syncProject(projectId: string, client?: GitHubClient): Promise<SyncResult>`, onde
`SyncResult = { ok:true, inserted:{commits,branches,runs}, lastSeenSha:string|null }
| { ok:false, error:"project_not_found"|"no_token"|"github_error" }`:

1. `db.project.findUnique` → senão `project_not_found`.
2. `const gh = client === undefined ? createGitHubClient() : client;` → `gh === null` → `no_token`
   (sem rede). *(Em teste sempre injetamos stub; `no_token` só ocorre sem client e sem PAT no env.)*
3. `getRepo()` → `{ name, defaultBranch }` (`GitHubError` → `github_error`).
4. **Commits:** `listCommits({ since: project.lastPolledAt?.toISOString(), sha: defaultBranch })` →
   `mapCommit` → `createMany({ skipDuplicates: true })` (usa `@@unique([projectId, sha])`).
   `inserted.commits` = nº realmente inserido.
5. **Branches:** `upsert` por `(projectId, name)` (`isDefault = name === defaultBranch`) +
   `deleteMany({ projectId, name: { notIn: incomingNames } })`.
6. **Runs:** `upsert` por `(projectId, runId)`.
7. **Cursor + nome:** `lastSeenSha = HEAD do defaultBranch`; `lastPolledAt = new Date()`;
   `defaultBranch`/`name` atualizados; `project.update`.

---

## Impacto em PRD/SPEC e DOC.md

### `.docs/PRD.md`
- **§1/§2** — multi-projeto; **Projeto é a raiz** (cada projeto = 1 repo; futuras metas/atividades/
  quedas por projeto). 1 admin + 1 cliente mantidos; **Configurações segue admin-only**.
- **§8** — "projeto = 1 repositório"; ampliar de commits para **commits + Actions + branches** via
  **polling (worker) + sync manual**.
- **§5/§13** — "Commits Semanais" passa a contar `commits` por projeto (conceito intacto); ajustar
  menções a "repos"/múltiplos repositórios para "projetos".

### `.docs/SPEC.MD`
- **§2.8** — substituir `repos(...)` por `projects(id,name,owner,repo,description,default_branch,
  last_polled_at,last_seen_sha,created_at)`; `commits` passa a `project_id` + `@@unique(project_id,sha)`;
  **adicionar** `branches` e `workflow_runs`. Anotar que `goals`/`services`/`events` ganharão
  `project_id` nas suas specs.
- **§4** — trocar `/api/repos` por `/api/projects` (GET/POST), `/api/projects/:id` (GET/DELETE),
  `/api/projects/:id/sync` (POST). Nota: `commit.batch` + SSE pendentes da spec de Timeline.
- **§7** — worker estende p/ **commits + branches + Actions por projeto** (dedupe `(project,sha)`;
  branch upsert `(project,name)` + remoção de ausentes; run upsert `(project,run_id)`); **sync manual**
  disponível além do polling.
- **§2.5** `services` **inalterado** (sem `project_id` ainda — realocação é spec futura).

### DOC.md (CLAUDE.md §2.1/§2.3)
- **Criar:** `src/lib/github/DOC.md`, `src/app/api/projects/DOC.md`,
  `src/app/api/projects/[id]/DOC.md`, `src/app/api/projects/[id]/sync/DOC.md`.
- **Atualizar:** `src/lib/DOC.md` (subpasta `github/` + `projects.ts`), `src/app/api/DOC.md`
  (se existir; senão criar), `src/components/configuracoes/DOC.md` (ProjectCard → `projects-manager`
  funcional), `src/app/dashboard/configuracoes/DOC.md` (busca projetos + hasToken),
  `src/components/layout/DOC.md` (switcher real), `src/app/dashboard/DOC.md` (consome commits).

---

## Desenho dos testes

`test_levels: [unit, integration, e2e]` — puro (unit), serviços contra DB real (integração), jornadas
+ RBAC (e2e). **Infra real (§5.3):** Postgres `mirantes_test` real; **GitHub é o único externo →
stubado por injeção** (`makeStubClient` com fixtures iguais ao REST). Nada de mock no Postgres.
Limpeza por **truncate** entre testes.

**Passo vermelho (§5.4):** criar `map.ts`/`sync.ts`/`projects.ts` como **stubs sentinela** (puros
devolvem neutro: `mapCommit`→`{sha:"",message:"",author:"",committedAt:new Date(0)}`,
`summarizeCommitBatch`/`formatWeeklyDelta`→`""`, `deriveRunStatus`→`"neutral"`,
`isValidRepoSlug`→`false`; serviços async → `{ ok:false, error:"not_implemented" as never }` / no-op)
→ rodar → **falham nas asserções concretas** → marcar `status: tests-red` → implementar até verde
**sem alterar os testes**. Validar 1× quebrando o dedupe de propósito p/ confirmar que o teste pega.

### Casos — Unit
| função | entrada | esperado |
|---|---|---|
| `mapCommit` | msg `"feat: x\n\ncorpo"`, author.name `"Ana"` | message `"feat: x"`, author `"Ana"`, committedAt `Date` |
| `mapCommit` | name `null`, login `"ghost"` | author `"ghost"` |
| `mapCommit` | name `null`, author `null` | author `"desconhecido"` |
| `summarizeCommitBatch` | `(0,"r")`/`(1,"r")`/`(5,"r")` | `""`/`"1 commit em r"`/`"5 commits em r"` |
| `deriveRunStatus` | completed×{success,failure,cancelled,null}, in_progress, queued | success/failure/cancelled/neutral/running/queued |
| `isValidRepoSlug` | `("devlucasemiliano","mirantes.live")`/`("","x")`/`("a b","x")`/`("ok","na/me")`/`("a_.-","B0")` | true/false/false/false/true |
| `formatWeeklyDelta` | `(0,0)`/`(5,0)`/`(11,10)`/`(8,10)` | `"sem commits ainda"`/`"+100% vs semana anterior"`/`"+10% vs semana anterior"`/`"-20% vs semana anterior"` |

### Casos — Integração (`syncProject`, Postgres real, GitHub stub)
- **1º sync** insere tudo (`inserted={3,2,2}`); branch default marcada; cursor/`name`/`defaultBranch` setados.
- **2º sync** com SHAs sobrepostos **dedupe** (`commits=1`, total 4; cursor avança).
- **sem novidades** (`commits=0`, total intacto, `lastPolledAt` ainda atualiza).
- **branches** rename/delete → termina exatamente `main`+`feat-y`.
- **runs** upsert por `runId` → 1 linha, campos atualizados.
- **project_not_found**; **no_token** (sem client e sem PAT no env de teste → sem rede).

### Casos — Integração (`projects.ts`, Postgres real)
- create happy / `invalid_slug` (nada gravado) / `already_exists` (P2002, 1 linha).
- list em ordem de criação; get `not_found`/happy (relações); delete cascateia (filhos→0; repetir→`not_found`).
- `weeklyCommitStats`: semeia commits em janelas (≤7d e 7–14d) → `{count, previousCount}` corretos.
- `latestCommit`: devolve o `committedAt` mais recente com o nome do projeto; null sem commits.

### Casos — E2E (Playwright, app + DB de teste pré-semeado)
- **admin** abre `/dashboard/configuracoes` → vê o projeto semeado + log (commits/branches) → **adiciona**
  novo projeto (owner/repo) → aparece na lista.
- **admin** clica "Sincronizar Agora" **sem PAT** → mensagem amigável (`no_token`), sem rede.
- **RBAC cliente**: `POST /api/projects` como cliente → **403**; `GET /dashboard/configuracoes` →
  **redirect** p/ `/dashboard`.
- **Switcher**: o header em `/dashboard` mostra o **nome real** do projeto semeado.

---

## Os testes (código)

> Escritos para **falhar** antes da feature existir. Vitest/Playwright importados explicitamente
> (sem globals), casando com o Biome.

### `tests/setup/db.ts` (alterar `truncateAll`)
```ts
export async function truncateAll(): Promise<void> {
  // `projects` CASCADE limpa commits/branches/workflow_runs (FK→projects);
  // `users` CASCADE limpa sessions/avatars (FK→users).
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "users", "projects" RESTART IDENTITY CASCADE`,
  );
}
```

### `tests/setup/github.ts` (stub + fixtures realistas)
```ts
import type { GhBranch, GhCommit, GhWorkflowRun, GitHubClient } from "@/lib/github/client";

export function makeStubClient(data: {
  name?: string;
  defaultBranch: string;
  commits: GhCommit[];
  branches: GhBranch[];
  runs: GhWorkflowRun[];
}): GitHubClient {
  return {
    getRepo: async () => ({ name: data.name ?? "repo", defaultBranch: data.defaultBranch }),
    listCommits: async () => data.commits,
    listBranches: async () => data.branches,
    listWorkflowRuns: async () => data.runs,
  };
}

export function ghCommit(sha: string, message = "feat: x", date = "2026-06-10T12:00:00Z"): GhCommit {
  return {
    sha,
    html_url: `https://github.com/o/r/commit/${sha}`,
    commit: { message, author: { name: "Ana", date } },
    author: { login: "ana-gh" },
  };
}
export function ghBranch(name: string, sha = "deadbeef"): GhBranch {
  return { name, commit: { sha }, protected: false };
}
export function ghRun(id: number, overrides: Partial<GhWorkflowRun> = {}): GhWorkflowRun {
  return {
    id, name: "CI", head_branch: "main", head_sha: "deadbeef", run_number: id,
    status: "completed", conclusion: "success",
    html_url: `https://github.com/o/r/actions/runs/${id}`,
    run_started_at: "2026-06-10T12:00:00Z", updated_at: "2026-06-10T12:05:00Z",
    ...overrides,
  };
}
```

### `tests/unit/github-map.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { deriveRunStatus, isValidRepoSlug, mapCommit, summarizeCommitBatch } from "@/lib/github/map";

describe("mapCommit", () => {
  it("usa a 1ª linha da mensagem como subject", () => {
    const row = mapCommit({
      sha: "abc123", html_url: "https://github.com/x/y/commit/abc123",
      commit: { message: "feat: assunto\n\ncorpo", author: { name: "Ana", date: "2026-06-10T12:00:00Z" } },
      author: { login: "ana-gh" },
    });
    expect(row.sha).toBe("abc123");
    expect(row.message).toBe("feat: assunto");
    expect(row.author).toBe("Ana");
    expect(row.committedAt).toEqual(new Date("2026-06-10T12:00:00Z"));
  });
  it("cai para login sem commit.author.name", () => {
    const row = mapCommit({
      sha: "def456", html_url: "https://github.com/x/y/commit/def456",
      commit: { message: "fix: algo", author: { name: null, date: "2026-06-11T09:30:00Z" } },
      author: { login: "ghost" },
    });
    expect(row.author).toBe("ghost");
  });
  it("cai para 'desconhecido' sem nome nem login", () => {
    const row = mapCommit({
      sha: "000", html_url: "https://github.com/x/y/commit/000",
      commit: { message: "chore: x", author: { name: null, date: "2026-06-11T09:30:00Z" } },
      author: null,
    });
    expect(row.author).toBe("desconhecido");
  });
});

describe("summarizeCommitBatch", () => {
  it("vazio p/ 0", () => expect(summarizeCommitBatch(0, "mirantes")).toBe(""));
  it("singular p/ 1", () => expect(summarizeCommitBatch(1, "mirantes")).toBe("1 commit em mirantes"));
  it("plural p/ N", () => expect(summarizeCommitBatch(5, "mirantes")).toBe("5 commits em mirantes"));
});

describe("deriveRunStatus", () => {
  it("success", () => expect(deriveRunStatus({ status: "completed", conclusion: "success" })).toBe("success"));
  it("failure", () => expect(deriveRunStatus({ status: "completed", conclusion: "failure" })).toBe("failure"));
  it("cancelled", () => expect(deriveRunStatus({ status: "completed", conclusion: "cancelled" })).toBe("cancelled"));
  it("running", () => expect(deriveRunStatus({ status: "in_progress", conclusion: null })).toBe("running"));
  it("queued", () => expect(deriveRunStatus({ status: "queued", conclusion: null })).toBe("queued"));
  it("neutral", () => expect(deriveRunStatus({ status: "completed", conclusion: null })).toBe("neutral"));
});

describe("isValidRepoSlug", () => {
  it("válido", () => expect(isValidRepoSlug("devlucasemiliano", "mirantes.live")).toBe(true));
  it("vazio", () => expect(isValidRepoSlug("", "x")).toBe(false));
  it("espaço", () => expect(isValidRepoSlug("a b", "x")).toBe(false));
  it("barra", () => expect(isValidRepoSlug("ok", "na/me")).toBe(false));
  it("charset ._-", () => expect(isValidRepoSlug("a_.-", "B0")).toBe(true));
});
```

### `tests/unit/summary.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { formatWeeklyDelta } from "@/lib/github/map";

describe("formatWeeklyDelta", () => {
  it("sem base e sem commits", () => expect(formatWeeklyDelta(0, 0)).toBe("sem commits ainda"));
  it("semana anterior zero, com commits agora → +100%", () =>
    expect(formatWeeklyDelta(5, 0)).toBe("+100% vs semana anterior"));
  it("crescimento", () => expect(formatWeeklyDelta(11, 10)).toBe("+10% vs semana anterior"));
  it("queda", () => expect(formatWeeklyDelta(8, 10)).toBe("-20% vs semana anterior"));
});
```

### `tests/integration/sync.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { ghBranch, ghCommit, ghRun, makeStubClient } from "../setup/github";

async function seedProject() {
  return db.project.create({ data: { name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" } });
}

it("1º sync insere commits, branches e runs e avança o cursor", async () => {
  const project = await seedProject();
  const res = await syncProject(project.id, makeStubClient({
    defaultBranch: "main",
    commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
    branches: [ghBranch("main", "a1"), ghBranch("feat-x", "b9")],
    runs: [ghRun(1), ghRun(2)],
  }));
  expect(res).toMatchObject({ ok: true, inserted: { commits: 3, branches: 2, runs: 2 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(3);
  const main = await db.branch.findFirstOrThrow({ where: { projectId: project.id, name: "main" } });
  expect(main.isDefault).toBe(true);
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  expect(after.lastSeenSha).toBe("a1");
  expect(after.lastPolledAt).not.toBeNull();
});

it("2º sync deduplica commits por SHA e só insere os novos", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
    branches: [ghBranch("main", "a1")], runs: [],
  }));
  const res = await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [ghCommit("a4"), ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
    branches: [ghBranch("main", "a4")], runs: [],
  }));
  expect(res).toMatchObject({ ok: true, inserted: { commits: 1 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(4);
  expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).lastSeenSha).toBe("a4");
});

it("sem commits novos: total intacto, lastPolledAt ainda atualiza", async () => {
  const project = await seedProject();
  const res = await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main", "a1")], runs: [],
  }));
  expect(res).toMatchObject({ ok: true, inserted: { commits: 0 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(0);
  expect((await db.project.findUniqueOrThrow({ where: { id: project.id } })).lastPolledAt).not.toBeNull();
});

it("branches: remove as que sumiram e mantém as atuais", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main"), ghBranch("feat-x")], runs: [],
  }));
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main"), ghBranch("feat-y")], runs: [],
  }));
  const names = (await db.branch.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" } })).map((b) => b.name);
  expect(names).toEqual(["feat-y", "main"]);
});

it("workflow runs: upsert por runId atualiza o mesmo registro", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main")],
    runs: [ghRun(1, { status: "in_progress", conclusion: null })],
  }));
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main")],
    runs: [ghRun(1, { status: "completed", conclusion: "success" })],
  }));
  const runs = await db.workflowRun.findMany({ where: { projectId: project.id } });
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("completed");
  expect(runs[0]?.conclusion).toBe("success");
});

it("projeto inexistente → project_not_found", async () => {
  const res = await syncProject("00000000-0000-0000-0000-000000000000",
    makeStubClient({ defaultBranch: "main", commits: [], branches: [], runs: [] }));
  expect(res).toEqual({ ok: false, error: "project_not_found" });
});

it("sem PAT e sem client injetado → no_token (sem rede)", async () => {
  const project = await seedProject();
  const res = await syncProject(project.id); // env de teste não define GITHUB_PAT
  expect(res).toEqual({ ok: false, error: "no_token" });
});
```

### `tests/integration/projects.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createProject, deleteProject, getProject, latestCommit, listProjects, weeklyCommitStats,
} from "@/lib/projects";

it("cria projeto válido", async () => {
  const res = await createProject({ name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" });
  expect(res.ok).toBe(true);
  expect(await db.project.count()).toBe(1);
});
it("rejeita slug inválido sem gravar", async () => {
  const res = await createProject({ name: "X", owner: "a b", repo: "x" });
  expect(res).toEqual({ ok: false, error: "invalid_slug" });
  expect(await db.project.count()).toBe(0);
});
it("rejeita (owner, repo) duplicado", async () => {
  await createProject({ name: "X", owner: "o", repo: "r" });
  const res = await createProject({ name: "Y", owner: "o", repo: "r" });
  expect(res).toEqual({ ok: false, error: "already_exists" });
  expect(await db.project.count()).toBe(1);
});
it("lista em ordem de criação", async () => {
  await createProject({ name: "A", owner: "o", repo: "a" });
  await createProject({ name: "B", owner: "o", repo: "b" });
  const res = await listProjects();
  expect(res.projects.map((p) => p.name)).toEqual(["A", "B"]);
});
it("get inexistente → not_found", async () => {
  expect(await getProject("00000000-0000-0000-0000-000000000000")).toEqual({ ok: false, error: "not_found" });
});
it("delete cascateia os filhos", async () => {
  const created = await createProject({ name: "A", owner: "o", repo: "a" });
  if (!created.ok) throw new Error("setup falhou");
  await db.commit.create({ data: { projectId: created.project.id, sha: "x1", message: "m", author: "a", committedAt: new Date() } });
  expect(await deleteProject(created.project.id)).toEqual({ ok: true });
  expect(await db.project.count()).toBe(0);
  expect(await db.commit.count()).toBe(0);
  expect(await deleteProject(created.project.id)).toEqual({ ok: false, error: "not_found" });
});
it("weeklyCommitStats conta nas janelas de 7d e 7–14d", async () => {
  const c = await createProject({ name: "A", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  const day = 24 * 60 * 60 * 1000;
  const mk = (sha: string, ageDays: number) =>
    db.commit.create({ data: { projectId: c.project.id, sha, message: "m", author: "a", committedAt: new Date(Date.now() - ageDays * day) } });
  await mk("now1", 1); await mk("now2", 3);          // janela atual (≤7d)
  await mk("prev1", 9);                               // janela anterior (7–14d)
  const stats = await weeklyCommitStats();
  expect(stats).toEqual({ count: 2, previousCount: 1 });
});
it("latestCommit devolve o mais recente com o nome do projeto", async () => {
  const c = await createProject({ name: "Mirantes", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  await db.commit.create({ data: { projectId: c.project.id, sha: "old", message: "old", author: "a", committedAt: new Date("2026-06-01T00:00:00Z") } });
  await db.commit.create({ data: { projectId: c.project.id, sha: "new", message: "novo", author: "a", committedAt: new Date("2026-06-10T00:00:00Z") } });
  const got = await latestCommit();
  expect(got?.sha).toBe("new");
  expect(got?.projectName).toBe("Mirantes");
});
```

### `tests/e2e/configuracoes-projetos.spec.ts`
```ts
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

test("admin vê o projeto semeado com log e adiciona um novo", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");
  await expect(page.getByText("mirantes.live")).toBeVisible();
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
  await expect(page.getByText(/configure o github_pat|sem token/i)).toBeVisible();
});

test("cliente não acessa Configurações e POST /api/projects → 403", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/configuracoes");
  await expect(page).toHaveURL(/\/dashboard$/); // redirecionado
  const res = await page.request.post("/api/projects", { data: { name: "Hack", owner: "x", repo: "y" } });
  expect(res.status()).toBe(403);
});

test("switcher do header mostra o nome real do projeto", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Mirantes.Live Dashboard")).toBeVisible();
});
```

---

## Ordem de build (respeita §5.5)

1. **Harness verde da 007** (`mirantes_test`). Estender `truncateAll` (`projects`).
2. **Schema** + `bunx prisma migrate dev --name projects_github` + `bunx prisma generate` + seed do
   projeto dev.
3. `github/map.ts` (+ `formatWeeklyDelta`) → **unit** (vermelho→verde).
4. `projects.ts`, `github/client.ts`, `github/sync.ts` + `tests/setup/github.ts` → **integração**
   (vermelho→verde). `worker.ts` (fino, sem teste).
5. API `app/api/projects/*` (handlers finos + RBAC).
6. UI: `projects-manager.tsx` em Configurações; Switcher real (`AppHeader` busca nome); Visão Geral
   ("Commits da Semana" + "último commit"). Remover `ProjectCard` mock e `mockProject`.
7. **E2E** `configuracoes-projetos.spec.ts` com pré-seed de commits/branches (vermelho→verde).
8. Fechamento: `.docs/PRD.md` + `.docs/SPEC.MD`, todos os DOC.md, `bunx biome check` +
   `bun run typecheck`, `status: done`.

## Critérios de pronto

- `Project`/`Commit`/`Branch`/`WorkflowRun` + migração + seed; PRD §1/§2/§8 e SPEC §2.8/§4/§7 atualizados.
- Projeto puxa **commits + Actions + branches + nome** com persistência e dedupe; gerência completa em
  Configurações (add/remover/sincronizar/expandir-log); cliente em leitura (403 em mutação, sem acesso
  à tela).
- Sync manual (`POST /api/projects/:id/sync`) **e** worker (`bun run src/lib/github/worker.ts`) sobre o
  mesmo `syncProject`.
- Switcher mostra nome real; Visão Geral mostra "Commits da Semana" real + "último commit".
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres real, GitHub stubado por
  fixtures (§5.3); sem mocks proibidos.
- `bunx biome check` + `bun run typecheck` limpos; sem import morto (`mockProject`/`ProjectCard` saíram).
- Todos os DOC.md criados/atualizados; spec `008` marcada **`done`**.

## Verificação

- `bun run test:all` verde; rodar 1× quebrando o dedupe de propósito (anti-"teste de mentira" §5.4).
- Manual: `bun run db:seed` → `bun run dev` → logar admin → Configurações → adicionar projeto
  (owner/repo) → "Sincronizar Agora" (com `GITHUB_PAT` real no `.env`) → ver commits/Actions/branches
  persistirem após reload; Switcher e "Commits da Semana" refletindo o real; cliente sem acesso à tela.
- `bun run worker:github` puxa periodicamente sem vazar o PAT em log.

---

## Divergências da implementação (registro vivo — CLAUDE.md §3.2)

Diferenças necessárias entre o plano e o que foi construído (todas preservam a intenção):

1. **`tests/e2e/configuracoes-projetos.spec.ts` — teste 1, 1ª asserção.** O plano usava
   `expect(page.getByText("mirantes.live")).toBeVisible()`. O **switcher do header** mostra o nome
   do projeto raiz ("Mirantes.Live Dashboard"), que **contém** "mirantes.live" → no **strict mode**
   do Playwright (`toBeVisible` exige 1 elemento) isso resolve p/ múltiplos e falha. Trocado por
   `expect(page.getByTestId("project-row").first()).toContainText("mirantes.live")` — escopa à 1ª
   linha de projeto (usa o `data-testid` já previsto no plano), preservando a intenção (o repo
   semeado aparece na lista). As outras 3 asserções de texto foram mantidas verbatim (são únicas).
2. **`POST /api/projects` — nome default.** Sem nome, usa `repo` (não `owner/repo`), p/ a linha
   nunca duplicar o texto do slug `owner/repo` (senão `getByText("e2e-owner/e2e-repo")` casaria 2
   elementos no strict mode). O slug `owner/repo` aparece à parte na UI.
3. **`src/app/dashboard/page.tsx` — bloco "último commit".** Mostra sha/mensagem/autor/tempo, mas
   **não** o `projectName`, p/ não colidir com o switcher na asserção `getByText("Mirantes.Live
   Dashboard")` do teste 4 (strict mode). `latestCommit()` ainda devolve `projectName` (usado nos
   testes de integração).
4. **`vitest.config.ts`.** Adicionado `GITHUB_PAT: ""` ao `test.env` p/ tornar o caso `no_token`
   **hermético** (independe de o Bun auto-carregar um `.env` com PAT). Honra o "env de teste não
   define GITHUB_PAT" do plano.
5. **`src/components/layout/public-header.tsx`.** Também passou a alimentar o `ProjectSwitcher`
   (que ganhou a prop `projectName`). A home é pública/sem sessão → usa o `projectName` do **snapshot
   do Redis** (não consulta o banco). O plano só citava o `app-header`.
6. **`playwright.config.ts` — `workers: 1`.** A suíte e2e compartilha 1 banco e o fluxo de senha
   (007) troca a senha do admin temporariamente; paralelizar arquivos causaria corrida no login.
7. **Pré-seed e2e via subprocesso `bun`.** `tests/e2e/seed-activity.ts` (idempotente) é chamado pelo
   `global-setup` via `execSync("bun run …")` — runtime real do app, evitando arestas do loader do
   Playwright com o adapter do Prisma. Mesmo efeito do "inserir createMany skipDuplicates" do plano.
8. **`createGitHubClient`** retorna `null` p/ token **vazio ou** ausente (`!token`), não só ausente —
   cobre `GITHUB_PAT=""` (dev/teste) corretamente.
9. **Passo vermelho do e2e.** Unit/integração nasceram como sentinelas (vermelho→verde) e o dedupe foi
   quebrado 1× p/ confirmar (§5.4). O e2e foi escrito após a UI; p/ honrar o passo vermelho, validou-se
   por **break-and-observe**: quebrando a mensagem amigável do `no_token`, o teste "sincronizar sem PAT"
   ficou **vermelho** (timeout no regex), e voltou **verde** ao restaurar. Cobertura final: `bun run
   test:all` = 51 unit/integração + 8 e2e, tudo verde.
