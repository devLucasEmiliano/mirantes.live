---
id: 008
title: Projetos — multi-projeto + sync GitHub (commits/Actions/branches) + Monitoramento realocado
status: draft        # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-16
---

# 008 — Projetos: multi-projeto + sync GitHub + Monitoramento realocado

## Objetivo

Introduzir a entidade **Projeto** (cada Projeto = **exatamente 1 repositório GitHub** + seus
serviços) e:

1. **Puxar do GitHub** os **commits**, **GitHub Actions (workflow runs)** e **branches** do repo de
   cada projeto, via **worker de polling com persistência** no Postgres (dedupe por SHA, avanço de
   cursor `last_seen_sha`/`last_polled_at`).
2. **Mover o Monitoramento de Uptime para dentro de Projetos**: a UI passa a viver no detalhe do
   projeto e `services` ganha `project_id` (serviços por-projeto).

O app deixa de ser single-project. Continua **1 admin + 1 cliente**; o cliente vê **todos os
projetos em leitura**.

## Contexto e justificativa

- Hoje só existem as tabelas `users`/`sessions` (spec 003). Não há entidade Projeto, nem cliente
  GitHub, nem worker, nem SSE. `env.GITHUB_PAT` já é validado (opcional) mas **não é usado**.
- Os cards de monitoramento (`/dashboard/monitoramento` e o `UptimeMonitoringCard` de Configurações)
  e o "Projetos" são 100% mock (`src/lib/mock-data.ts`).
- Multi-projeto **contraria** o PRD atual (single-project) → CLAUDE.md §1 exige **atualizar PRD/SPEC**
  junto (feito nesta task). **Actions + branches não constam no SPEC** (que só cobre commits) → o SPEC
  §2.8/§7 é **estendido**.
- **Documentos-fonte ficam em `.docs\PRD.md` e `.docs\SPEC.MD`** (MAIÚSCULO), não na raiz.

## Dependência de ordem (CLAUDE.md §5.5)

Depende do **harness de testes da spec 007** (Vitest + Playwright + Postgres `mirantes_test`). 007
está em execução; 008 só implementa sobre o harness **verde**. Esta é a 1ª spec a criar tabelas de
domínio além de auth.

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

1. **1 Projeto = 1 repositório GitHub + serviços próprios.** Vários projetos permitidos; o antigo
   `repos` (SPEC §2.8) é **dobrado em `projects`** (owner/repo/last_polled_at/last_seen_sha viram
   colunas do projeto).
2. **GitHub via worker de polling + persistência** (não on-demand): núcleo testável `syncProject`,
   loop fino por cima.
3. **Monitoramento: só realocar** (UI dentro de Projetos + `services.project_id`). **Probes reais**
   (worker HTTP/Docker, `service_checks`, `incidents`, uptime%) ficam para a **spec 009**.

### A confirmar neste review (SDD)
- (a) Rota antiga `/dashboard/monitoramento`: **redirect** p/ `/dashboard/projetos` (recomendado) vs
  remover de vez.
- (b) Remover `UptimeMonitoringCard` de Configurações **agora** (recomendado) vs manter até a 009.
- (c) `owner`/`repo` exatos do projeto dev no seed (proposto: `devlucasemiliano` / `guia-goals`).

## Arquivos a criar/alterar

### Schema, seed, migração
- **Alterar** `prisma\schema.prisma` — modelos `Project`, `Commit`, `Branch`, `WorkflowRun`,
  `Service` (ver "Mudanças de schema").
- **Nova migração** `npx prisma migrate dev --name projects_github`.
- **Alterar** `prisma\seed.ts` — upsert idempotente de 1 projeto dev (por `@@unique([owner, repo])`)
  + 1–2 `Service` ligados. **Sem** commits/runs (vêm do sync/stub).

### Camada GitHub (NOVA) — `src\lib\github\`
- **Criar** `client.ts` — único ponto HTTP com o GitHub (`fetch` nativo + `env.GITHUB_PAT`; **sem
  Octokit**, stack travada §0). Tipos `GhCommit`/`GhBranch`/`GhWorkflowRun`, interface injetável
  `GitHubClient`, `createGitHubClient(token = env.GITHUB_PAT): GitHubClient | null` (**null** se não
  há PAT), `class GitHubError`. Nunca loga/expõe o PAT (SPEC §7/§11).
  - `getRepo({owner,repo}) → { defaultBranch }` (`GET /repos/{o}/{r}` campo `default_branch`).
  - `listCommits({owner,repo,since?,sha?,perPage?})` (`GET /repos/{o}/{r}/commits`).
  - `listBranches({owner,repo,perPage?})` (`GET /repos/{o}/{r}/branches`).
  - `listWorkflowRuns({owner,repo,perPage?})` (`GET /repos/{o}/{r}/actions/runs`, envelope
    `{ workflow_runs }`).
- **Criar** `map.ts` (puro) — `mapCommit`, `summarizeCommitBatch`, `deriveRunStatus`,
  `isValidRepoSlug` (ver testes).
- **Criar** `sync.ts` — `syncProject(projectId, client?)` idempotente (ver "Mudanças de schema" p/ a
  chave de dedupe). Onde retorna sucesso, deixar
  `// TODO(spec-timeline): emitir evento commit.batch + PUBLISH goals:updates` (events/SSE ainda não
  existem — fora de escopo).
- **Criar** `worker.ts` (fino, **fora** de `test_levels`) — `runGitHubSyncLoop({ intervalMs })` itera
  `db.project.findMany` chamando `syncProject`, loga `inserted` (nunca o PAT), sobrevive a erro
  por-projeto, encerra em SIGINT/SIGTERM. Rodado por script `worker:github` → `tsx
  src/lib/github/worker.ts`.

### Camada de projetos (NOVA)
- **Criar** `src\lib\projects.ts` — `createProject` / `listProjects` / `getProject` / `deleteProject`
  (retornos discriminados; ver testes).

### Endpoints
- **Criar** `src\app\api\projects\route.ts` — `GET` (auth, `listProjects`) + `POST` (admin,
  `createProject`).
- **Criar** `src\app\api\projects\[id]\route.ts` — `GET` (auth, `getProject`) + `DELETE` (admin,
  `deleteProject`).
- **Criar** `src\app\api\projects\[id]\sync\route.ts` — `POST` (admin, `syncProject`).
- Handlers finos (padrão `auth\password\route.ts`): `getCurrentUser()` (401) → `role==="admin"`
  senão **403** → zod (400) → serviço → HTTP. DTO serializa `WorkflowRun.runId` com `String(...)`.
  **DTO do cliente** omite config de serviço (`okStatusCodes`, `latencyThresholdMs`,
  `intervalSeconds`, `failureThreshold`, `consecutiveFailures`); mantém `name/checkType/target/
  currentState` e commits/branches/runs.

### Frontend
- **Criar** `src\app\dashboard\projetos\page.tsx` (server) — `requireUser()` → `listProjects()` →
  lista. Form "Novo Projeto" só p/ admin.
- **Criar** `src\app\dashboard\projetos\[id]\page.tsx` (server) — `requireUser()` → `getProject(id)`
  (404) → `AppHeader` + seção GitHub (commits/Actions/branches) + seção Monitoramento realocada +
  botão admin "Sincronizar agora".
- **Criar** `src\components\projetos\` — `project-list.tsx` (`"use client"`), `commits-card.tsx`,
  `actions-card.tsx`, `branches-card.tsx`, `sync-button.tsx`.
- **Alterar** `src\components\monitoramento\service-cards.tsx` — cards passam a aceitar `services` por
  prop (default = mock p/ não quebrar). Métricas de probe ficam **placeholder** (worker = 009).
- **Alterar** `src\components\layout\sidebar.tsx` — `NAV_ITEMS`: **+ "Projetos"** (ícone lucide
  `Boxes`/`FolderGit2`), **− "Monitoramento"**.
- **Alterar** `src\app\dashboard\monitoramento\page.tsx` — vira **redirect** p/ `/dashboard/projetos`.
- **Alterar** `src\app\dashboard\configuracoes\page.tsx` + `src\components\configuracoes\tools-cards.tsx`
  — remover `UptimeMonitoringCard`.

### Harness de testes (reusa 007)
- **Alterar** `tests\setup\db.ts` — `truncateAll()` inclui as novas tabelas.
- **Criar** `tests\setup\github.ts` — `makeStubClient(...)` + fixtures `ghCommit`/`ghBranch`/`ghRun`.
- **Criar** `tests\unit\github-map.test.ts`, `tests\integration\sync.test.ts`,
  `tests\integration\projects.test.ts`, `tests\e2e\projetos.spec.ts`.
- **Alterar** `tests\e2e\global-setup.ts` — após migrate+seed, inserir fixtures de GitHub
  (commits/branches/runs) idempotentes p/ o projeto dev (e2e determinístico).
- **Alterar** `package.json` — script `"worker:github": "tsx src/lib/github/worker.ts"`.

## Mudanças de schema

```prisma
/// Um Projeto = exatamente 1 repositório GitHub + seus serviços (PRD §8).
/// Dobra a antiga `repos` (owner/name/last_polled_at/last_seen_sha — SPEC §2.8).
model Project {
  id           String        @id @default(uuid()) @db.Uuid
  name         String
  owner        String
  repo         String
  description  String?
  lastPolledAt DateTime?     @map("last_polled_at")
  lastSeenSha  String?       @map("last_seen_sha")
  createdAt    DateTime      @default(now()) @map("created_at")
  commits      Commit[]
  branches     Branch[]
  workflowRuns WorkflowRun[]
  services     Service[]
  @@unique([owner, repo])
  @@map("projects")
}

model Commit {
  id          String   @id @default(uuid()) @db.Uuid
  projectId   String   @map("project_id") @db.Uuid
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sha         String
  message     String                                   // subject (1ª linha)
  author      String
  committedAt DateTime @map("committed_at")
  createdAt   DateTime @default(now()) @map("created_at")
  @@unique([projectId, sha])                            // chave de dedupe do sync
  @@index([projectId, committedAt])
  @@map("commits")
}

model Branch {
  id        String   @id @default(uuid()) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name      String
  commitSha String   @map("commit_sha")
  isDefault Boolean  @default(false) @map("is_default")
  updatedAt DateTime @updatedAt @map("updated_at")      // toque local do sync
  @@unique([projectId, name])
  @@map("branches")
}

model WorkflowRun {
  id           String    @id @default(uuid()) @db.Uuid
  projectId    String    @map("project_id") @db.Uuid
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  runId        BigInt    @map("run_id")                 // id numérico do GitHub (estoura int32)
  name         String
  headBranch   String?   @map("head_branch")
  headSha      String    @map("head_sha")
  status       String                                   // queued|in_progress|completed
  conclusion   String?                                  // success|failure|cancelled|null
  runNumber    Int       @map("run_number")
  htmlUrl      String    @map("html_url")
  runStartedAt DateTime? @map("run_started_at")
  updatedAt    DateTime  @map("updated_at")             // updated_at do GitHub (dado, não @updatedAt)
  @@unique([projectId, runId])
  @@index([projectId, runStartedAt])
  @@map("workflow_runs")
}

/// Serviço monitorado (SPEC §2.5), agora POR-PROJETO. Probes reais = spec 009.
model Service {
  id                  String   @id @default(uuid()) @db.Uuid
  projectId           String   @map("project_id") @db.Uuid
  project             Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name                String
  checkType           String   @map("check_type")               // 'http' | 'docker'
  target              String
  okStatusCodes       Int[]    @map("ok_status_codes")
  latencyThresholdMs  Int      @default(1000) @map("latency_threshold_ms")
  intervalSeconds     Int      @default(60) @map("interval_seconds")
  failureThreshold    Int      @default(3) @map("failure_threshold")
  currentState        String   @default("online") @map("current_state")
  consecutiveFailures Int      @default(0) @map("consecutive_failures")
  createdAt           DateTime @default(now()) @map("created_at")
  @@index([projectId])
  @@map("services")
}
```

**Deferido (009):** `service_checks`, `incidents`. **Deferido (Timeline/SSE):** `events`.

### `syncProject` — algoritmo (idempotente)
`syncProject(projectId: string, client?: GitHubClient): Promise<SyncResult>` onde
`SyncResult = { ok:true, inserted:{commits,branches,runs}, lastSeenSha:string|null } |
{ ok:false, error:"project_not_found"|"no_token"|"github_error" }`:
1. `db.project.findUnique` → senão `project_not_found`.
2. `const gh = client === undefined ? createGitHubClient() : client;` → se `gh` é `null` →
   `no_token` (sem rede). *(Em teste sempre injetamos stub; `no_token` só ocorre sem client e sem PAT.)*
3. `getRepo()` → `defaultBranch` (`GitHubError` → `github_error`).
4. **Commits:** `listCommits({ since: project.lastPolledAt?.toISOString(), sha: defaultBranch })` →
   `mapCommit` → `createMany({ data, skipDuplicates: true })` (usa `@@unique([projectId, sha])`).
   `inserted.commits` = nº realmente inserido.
5. **Branches:** `upsert` por `(projectId, name)` (`isDefault = name === defaultBranch`) +
   `deleteMany({ projectId, name: { notIn: incomingNames } })`.
6. **Runs:** `upsert` por `(projectId, runId)`.
7. **Cursor:** `lastSeenSha = HEAD do defaultBranch`; `lastPolledAt = new Date()`; `project.update`.

## Impacto em PRD/SPEC e DOC.md

### `.docs\PRD.md`
- **§1/§2** — multi-projeto (1 admin, 1 cliente; cliente vê **todos** os projetos em leitura;
  "Projetos" no menu; Monitoramento dentro de Projetos, sem aba própria).
- **§7** — serviços **por-projeto**, UI no detalhe do projeto.
- **§8** — "projeto = 1 repositório"; ampliar de commits para **commits + Actions + branches** via
  polling.
- **§5/§13** — ajustar menções a "repos"/múltiplos repositórios.

### `.docs\SPEC.MD`
- **§2.5** — `services` ganha `project_id` FK.
- **§2.8** — substituir `repos(...)` por `projects(id,name,owner,repo,description,last_polled_at,
  last_seen_sha,created_at)`; `commits` passa a `project_id` + `@@unique(project_id,sha)`; **adicionar**
  `branches` e `workflow_runs`.
- **§4** — trocar `/api/repos` por `/api/projects` (GET/POST), `/api/projects/:id` (GET/DELETE),
  `/api/projects/:id/sync` (POST). Nota: evento `commit.batch` + SSE pendentes da spec de Timeline/SSE.
- **§7** — worker estende p/ **commits + branches + Actions por projeto** (dedupe por `(project,sha)`;
  branch upsert por `(project,name)` + remoção de ausentes; run upsert por `(project,run_id)`).
- **§8** — "commits semanais" passa a contar sobre `commits` por projeto (conceito intacto).

### DOC.md (CLAUDE.md §2.1/§2.3)
- **Criar:** `src\lib\github\DOC.md`, `src\app\api\projects\DOC.md`,
  `src\app\api\projects\[id]\DOC.md`, `src\app\api\projects\[id]\sync\DOC.md`,
  `src\app\dashboard\projetos\DOC.md`, `src\app\dashboard\projetos\[id]\DOC.md`,
  `src\components\projetos\DOC.md`.
- **Atualizar:** `src\lib\DOC.md`, `src\app\api\DOC.md`, `src\components\DOC.md`,
  `src\components\layout\DOC.md`, `src\components\monitoramento\DOC.md`, `src\app\dashboard\DOC.md`,
  `src\app\dashboard\monitoramento\DOC.md`, `src\components\configuracoes\DOC.md`,
  `src\app\dashboard\configuracoes\DOC.md`.

## Desenho dos testes

`test_levels: [unit, integration, e2e]` — proporcional: puro (unit), serviços contra DB real
(integração), jornadas + RBAC (e2e).

**Infra real vs stub (§5.3):** Postgres `mirantes_test` **real**; **GitHub é o único externo →
stubado por injeção de dependência** (`makeStubClient` com fixtures iguais às respostas REST). Nunca
mockar Postgres. Limpeza por **truncate** entre testes.

**Passo vermelho (§5.4):** criar `map.ts`/`sync.ts`/`projects.ts` como **stubs sentinela** — puros
devolvem neutro (`mapCommit`→`{sha:"",message:"",author:"",committedAt:new Date(0)}`,
`summarizeCommitBatch`→`""`, `deriveRunStatus`→`"neutral"`, `isValidRepoSlug`→`false`); serviços
devolvem `{ ok:false, error:"not_implemented" as never }`. Rodar → **falham nas asserções concretas**
→ marcar `status: tests-red` → implementar até verde **sem alterar os testes**. Rodar 1× com o dedupe
quebrado de propósito p/ confirmar que o teste **pega**.

### Casos — Unit (`mapCommit`, `summarizeCommitBatch`, `deriveRunStatus`, `isValidRepoSlug`)
| função | entrada | esperado | borda |
|---|---|---|---|
| mapCommit | msg `"feat: x\n\ncorpo"`, author.name `"Ana"` | message `"feat: x"`, author `"Ana"` | subject = 1ª linha |
| mapCommit | name `null`, login `"ghost"` | author `"ghost"` | fallback p/ login |
| mapCommit | name `null`, author `null` | author `"desconhecido"` | fallback final |
| summarizeCommitBatch | `(0,"r")` / `(1,"r")` / `(5,"r")` | `""` / `"1 commit em r"` / `"5 commits em r"` | singular/plural/zero |
| deriveRunStatus | completed×{success,failure,cancelled,null}, in_progress, queued | success/failure/cancelled/neutral/running/queued | todos os pares |
| isValidRepoSlug | válido / `""` / `"a b"` / `"na/me"` / `"a_.-"` | true/false/false/false/true | charset |

### Casos — Integração (`syncProject`, Postgres real, GitHub stub)
- **1º sync** insere tudo (`inserted={3,2,2}`); default branch marcada; `lastSeenSha`/`lastPolledAt` setados.
- **2º sync** com SHAs sobrepostos **dedupe** (`commits=1`, total 4; cursor avança).
- **sem novidades** (`commits=0`, total intacto, `lastPolledAt` ainda atualiza).
- **branches** rename/delete → termina exatamente `main`+`feat-y`.
- **runs** upsert por `runId` → 1 linha, campos atualizados.
- **project_not_found**; **no_token** (sem client, sem PAT no env de teste → sem rede).

### Casos — Integração (`projects.ts`, Postgres real)
- create happy (normaliza, 1 linha) / invalid_slug (nada gravado) / already_exists (P2002, 1 linha).
- list ordenada por criação; get not_found / happy (relações); delete cascata (filhos→0; repetir→not_found).

### Casos — E2E (Playwright, app + DB de teste pré-semeado)
- admin abre o projeto semeado → vê cards commits/Actions/branches + seção Monitoramento no detalhe.
- admin cria projeto via "Novo Projeto" → navega ao detalhe.
- cliente vê Projetos em leitura (sem "Novo Projeto") e `POST /api/projects` como cliente → **403**.

---

## Os testes (código)

> Escritos para **falhar** antes da feature existir. Vitest/Playwright importados explicitamente
> (sem globals), casando com o Biome.

### `tests/setup/db.ts` (alteração — adicionar tabelas ao truncate)
```ts
// dentro de truncateAll(): incluir as tabelas de 008
await db.$executeRawUnsafe(
  `TRUNCATE TABLE "users", "sessions", "projects", "commits", "branches", "workflow_runs", "services" RESTART IDENTITY CASCADE`,
);
```

### `tests/setup/github.ts` (helper de stub — fixtures realistas)
```ts
import type {
  GhBranch,
  GhCommit,
  GhWorkflowRun,
  GitHubClient,
} from "@/lib/github/client";

/** Cliente GitHub falso (§5.3 — único externo stubado). */
export function makeStubClient(data: {
  defaultBranch: string;
  commits: GhCommit[];
  branches: GhBranch[];
  runs: GhWorkflowRun[];
}): GitHubClient {
  return {
    getRepo: async () => ({ defaultBranch: data.defaultBranch }),
    listCommits: async () => data.commits,
    listBranches: async () => data.branches,
    listWorkflowRuns: async () => data.runs,
  };
}

export function ghCommit(
  sha: string,
  message = "feat: x",
  date = "2026-06-10T12:00:00Z",
): GhCommit {
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
    id,
    name: "CI",
    head_branch: "main",
    head_sha: "deadbeef",
    run_number: id,
    status: "completed",
    conclusion: "success",
    html_url: `https://github.com/o/r/actions/runs/${id}`,
    run_started_at: "2026-06-10T12:00:00Z",
    updated_at: "2026-06-10T12:05:00Z",
    ...overrides,
  };
}
```

### `tests/unit/github-map.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  deriveRunStatus,
  isValidRepoSlug,
  mapCommit,
  summarizeCommitBatch,
} from "@/lib/github/map";

describe("mapCommit", () => {
  it("usa a primeira linha da mensagem como subject", () => {
    const row = mapCommit({
      sha: "abc123",
      html_url: "https://github.com/x/y/commit/abc123",
      commit: { message: "feat: assunto\n\ncorpo", author: { name: "Ana", date: "2026-06-10T12:00:00Z" } },
      author: { login: "ana-gh" },
    });
    expect(row.sha).toBe("abc123");
    expect(row.message).toBe("feat: assunto");
    expect(row.author).toBe("Ana");
    expect(row.committedAt).toEqual(new Date("2026-06-10T12:00:00Z"));
  });
  it("cai para author.login quando não há commit.author.name", () => {
    const row = mapCommit({
      sha: "def456",
      html_url: "https://github.com/x/y/commit/def456",
      commit: { message: "fix: algo", author: { name: null, date: "2026-06-11T09:30:00Z" } },
      author: { login: "ghost" },
    });
    expect(row.author).toBe("ghost");
  });
  it("cai para 'desconhecido' sem nome nem login", () => {
    const row = mapCommit({
      sha: "000",
      html_url: "https://github.com/x/y/commit/000",
      commit: { message: "chore: x", author: { name: null, date: "2026-06-11T09:30:00Z" } },
      author: null,
    });
    expect(row.author).toBe("desconhecido");
  });
});

describe("summarizeCommitBatch", () => {
  it("vazio para 0", () => expect(summarizeCommitBatch(0, "mirantes")).toBe(""));
  it("singular para 1", () => expect(summarizeCommitBatch(1, "mirantes")).toBe("1 commit em mirantes"));
  it("plural para N", () => expect(summarizeCommitBatch(5, "mirantes")).toBe("5 commits em mirantes"));
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
  it("válido", () => expect(isValidRepoSlug("devlucasemiliano", "guia-goals")).toBe(true));
  it("vazio", () => expect(isValidRepoSlug("", "x")).toBe(false));
  it("espaço", () => expect(isValidRepoSlug("a b", "x")).toBe(false));
  it("barra", () => expect(isValidRepoSlug("ok", "na/me")).toBe(false));
  it("charset ._-", () => expect(isValidRepoSlug("a_.-", "B0")).toBe(true));
});
```

### `tests/integration/sync.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { ghBranch, ghCommit, ghRun, makeStubClient } from "../setup/github";

async function seedProject() {
  return db.project.create({
    data: { name: "Guia Goals", owner: "devlucasemiliano", repo: "guia-goals" },
  });
}

it("primeiro sync insere commits, branches e runs e avança o cursor", async () => {
  const project = await seedProject();
  const res = await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a1"), ghBranch("feat-x", "b9")],
      runs: [ghRun(1), ghRun(2)],
    }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 3, branches: 2, runs: 2 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(3);
  const main = await db.branch.findFirstOrThrow({ where: { projectId: project.id, name: "main" } });
  expect(main.isDefault).toBe(true);
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  expect(after.lastSeenSha).toBe("a1");
  expect(after.lastPolledAt).not.toBeNull();
});

it("segundo sync deduplica commits por SHA e só insere os novos", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const res = await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a4"), ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a4")],
      runs: [],
    }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 1 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(4);
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  expect(after.lastSeenSha).toBe("a4");
});

it("sem commits novos: total intacto, lastPolledAt ainda atualiza", async () => {
  const project = await seedProject();
  const res = await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [], branches: [ghBranch("main", "a1")], runs: [] }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 0 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(0);
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  expect(after.lastPolledAt).not.toBeNull();
});

it("branches: remove as que sumiram e mantém as atuais", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [], branches: [ghBranch("main"), ghBranch("feat-x")], runs: [] }),
  );
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [], branches: [ghBranch("main"), ghBranch("feat-y")], runs: [] }),
  );
  const names = (
    await db.branch.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" } })
  ).map((b) => b.name);
  expect(names).toEqual(["feat-y", "main"]);
});

it("workflow runs: upsert por runId atualiza o mesmo registro", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(1, { status: "in_progress", conclusion: null })],
    }),
  );
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(1, { status: "completed", conclusion: "success" })],
    }),
  );
  const runs = await db.workflowRun.findMany({ where: { projectId: project.id } });
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("completed");
  expect(runs[0]?.conclusion).toBe("success");
});

it("projeto inexistente → project_not_found", async () => {
  const res = await syncProject(
    "00000000-0000-0000-0000-000000000000",
    makeStubClient({ defaultBranch: "main", commits: [], branches: [], runs: [] }),
  );
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
import { createProject, deleteProject, getProject, listProjects } from "@/lib/projects";

it("cria projeto válido", async () => {
  const res = await createProject({ name: "Guia Goals", owner: "devlucasemiliano", repo: "guia-goals" });
  expect(res.ok).toBe(true);
  expect(await db.project.count({ where: { owner: "devlucasemiliano", repo: "guia-goals" } })).toBe(1);
});

it("rejeita slug inválido sem gravar", async () => {
  const res = await createProject({ name: "X", owner: "a b", repo: "guia-goals" });
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
  const res = await getProject("00000000-0000-0000-0000-000000000000");
  expect(res).toEqual({ ok: false, error: "not_found" });
});

it("delete remove o projeto e cascateia os filhos", async () => {
  const created = await createProject({ name: "A", owner: "o", repo: "a" });
  if (!created.ok) throw new Error("setup falhou");
  await db.commit.create({
    data: { projectId: created.project.id, sha: "x1", message: "m", author: "a", committedAt: new Date() },
  });
  expect(await deleteProject(created.project.id)).toEqual({ ok: true });
  expect(await db.project.count()).toBe(0);
  expect(await db.commit.count()).toBe(0);
  expect(await deleteProject(created.project.id)).toEqual({ ok: false, error: "not_found" });
});
```

### `tests/e2e/projetos.spec.ts`
```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin vê commits, Actions, branches e Monitoramento no detalhe", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/projetos");
  await page.getByRole("link", { name: /guia-goals/i }).first().click();
  await expect(page.getByRole("heading", { name: /commits/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /actions/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /branches/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /monitoramento/i })).toBeVisible();
});

test("admin cria um novo projeto e chega no detalhe", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/projetos");
  await page.getByRole("button", { name: /novo projeto/i }).click();
  await page.getByLabel("Nome").fill("Projeto E2E");
  await page.getByLabel("Owner").fill("e2e-owner");
  await page.getByLabel(/reposit/i).fill("e2e-repo");
  await page.getByRole("button", { name: /criar/i }).click();
  await expect(page.getByRole("heading", { name: "Projeto E2E" })).toBeVisible();
});

test("cliente vê Projetos em leitura e POST /api/projects → 403", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/projetos");
  await expect(page.getByRole("button", { name: /novo projeto/i })).toHaveCount(0);
  const res = await page.request.post("/api/projects", {
    data: { name: "Hack", owner: "x", repo: "y" },
  });
  expect(res.status()).toBe(403);
});
```

---

## Ordem de build (respeita §5.5)

1. Harness da 007 verde (`mirantes_test`).
2. Schema + `migrate dev --name projects_github` + seed do projeto dev; atualizar `truncateAll`.
3. `github/map.ts` + unit (vermelho→verde).
4. `projects.ts`, `github/client.ts`, `github/sync.ts` + `tests/setup/github.ts` + integração
   (vermelho→verde).
5. API `app/api/projects/*`.
6. UI `dashboard/projetos` (lista+detalhe) + `components/projetos/*` + cards de monitoramento com prop
   `services` + sidebar (+Projetos/−Monitoramento) + redirect `/dashboard/monitoramento` + remover
   `UptimeMonitoringCard`.
7. E2E `tests/e2e/projetos.spec.ts` com pré-seed (vermelho→verde).
8. Fechamento: `.docs\PRD.md`+`.docs\SPEC.MD`, todos os DOC.md, `biome check`+`tsc --noEmit`,
   `status: done`.

## Critérios de pronto

- Schema `projects/commits/branches/workflow_runs/services` + migração + seed; PRD §1/§2/§7/§8 e
  SPEC §2.5/§2.8/§4/§7 atualizados.
- Projeto puxa **commits + Actions + branches** do GitHub com persistência e dedupe; serviços
  por-projeto; Monitoramento dentro do detalhe do projeto.
- Serviços `syncProject`/`createProject`/`getProject`/… extraídos; handlers finos; cliente em leitura
  (403 em mutação).
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres real (`mirantes_test`),
  GitHub stubado por fixtures (§5.3); sem mocks proibidos.
- Biome (lint+format) e `tsc --noEmit` verdes; sem import morto (mock saiu dos cards realocados).
- Todos os DOC.md criados/atualizados; spec marcada **`done`**.

## Verificação

- `npm run test:all` verde; rodar 1× quebrando o dedupe de propósito p/ confirmar que o teste **pega**
  (anti-"teste de mentira", §5.4).
- Manual: `npm run db:seed` → `npm run dev` → logar admin → criar Projeto (owner/repo) → "Sincronizar
  agora" (com `GITHUB_PAT` real no `.env`) → ver commits/Actions/branches persistirem após reload;
  seção de Monitoramento visível no detalhe; cliente vê em leitura, sem ações.
- `npx biome check` e `npm run typecheck` limpos.

## Fora de escopo

- Worker real de probes HTTP/Docker, `service_checks`, `incidents`, uptime%/latência/saúde → **spec 009**.
- CRUD real de serviços por projeto (add/editar/remover) → **009**.
- Emissão de evento `commit.batch` + SSE (`PUBLISH goals:updates`, `/api/stream`, tabela `events`) →
  spec de Timeline/SSE; 008 deixa só o **TODO hook** em `sync.ts`.
- Octokit / libs novas (usar `fetch` nativo — §0). Project switcher real. Rate-limit de sync.
- Teste do loop `worker.ts` (fino; o núcleo coberto é `syncProject`).
