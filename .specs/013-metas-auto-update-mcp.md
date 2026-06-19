---
id: 013
title: Metas reais (hierárquicas, X→Y) + auto-update por commits + servidor MCP
status: done         # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-19
---

# 013 — Metas reais + atribuição automática de commits + MCP

## Objetivo

Substituir o **mock** de Metas (`/dashboard/metas` hoje renderiza `mockGoals`) por metas
**reais**, persistidas, e fazer os **commits sincronizados avançarem as metas sozinhos**.
Concretamente:

1. **Modelo `Goal`** hierárquico (profundidade ilimitada via `parent_id`), com **derivação**
   de pai (progresso = média dos filhos; status derivado) e **soft delete** em cascata
   (PRD §4) — substitui o mock.
2. **Progresso medível X→Y** nas folhas: `start_value → target_value`, com `current_value`
   subindo conforme os commits chegam; ao atingir o alvo → **concluída**. Folha **sem alvo**
   mantém o progresso manual clássico 0–100 (as duas formas coexistem).
3. **Atribuição automática commit→meta** dentro do `syncProject` (só p/ commits **novos**):
   um **classificador LLM decide** (runtime plugável, OpenAI-compatível — Ollama/LM Studio/
   Unsloth — ou via MCP) e, **se o LLM estiver offline**, cai para o **resolver determinístico**
   (keyword `M-12` → branch vinculada → vínculo manual). Idempotente (anti double-count).
4. **Peso por tipo**: cada commit atribuído move `current_value` por um peso — **commit = 1,
   merge = 5** (config por env). **CI não conta** como progresso (segue só na timeline).
5. **Eventos `goal.*`** (`goal.created`/`goal.updated`/`goal.completed`/`goal.archived`)
   emitidos pelo pipeline de `events` já existente — alimentam a timeline (spec 012).
6. **API REST** `/api/goals*` (CRUD escopado por papel) e **UI real** trocando o `mockGoals`.
7. **Servidor MCP** (processo à parte, stdio) expondo metas (listar/criar/atualizar/vincular) a
   ferramentas externas como o **Claude Code**, **reusando o mesmo service** do REST.

## Contexto e justificativa

- Hoje não existe `model Goal` no Prisma nem `/api/goals`. `PRD.md` §4 e `SPEC.MD` §2.3 já
  especificam Metas — porém como **CRUD manual** (admin edita folha; pai deriva). Esta spec
  **implementa** essa base **e a estende** com X→Y medível, atribuição automática por commits e
  MCP. Por **CLAUDE.md §1**, as decisões abaixo são levadas a `PRD.md`/`SPEC.MD`/`CLAUDE.md` (não
  contornadas) — ver "Impacto".
- O gancho de integração já existe: `syncProject` (`src/lib/github/sync.ts:81`) **já isola os
  commits genuinamente novos** (`commitRows.filter(c => !existingShas.has(c.sha))`) antes de
  emitir `commit.created`. A atribuição roda **nessa mesma lista** — re-syncs não reprocessam.
- O padrão de mapper puro `EventInput` (`src/lib/events/emit.ts`) é replicado em
  `goals/emit.ts` (`goalToEvent`). O padrão `Scope`/`scopeForUser`/`commitOwnerWhere`
  (`src/lib/projects.ts`) é reusado em `goals/service.ts`.
- **`@modelcontextprotocol/sdk@1.29.0` já está no lockfile** (transitivo via `shadcn`), mas
  **não é dependência declarada** — promover a `dependencies` (CLAUDE.md §0 exige registro de
  lib nova; o humano aprovou neste chat).

> **Roadmap.** A spec 012 mapeava **012 → 013 Metas reais → 014 SSE**. Esta é a **013**; ela
> também **estende** a 013 original (que era só CRUD manual) com auto-update + X→Y + MCP, por
> decisão do humano neste chat (registro em "Decisões aprovadas"). **SSE/`PUBLISH goals:updates`
> seguem na 014** — aqui os eventos `goal.*` são só **gravados** em `events` (sem Pub/Sub).

> **Documentos-fonte:** `.docs/PRD.md` e `.docs/SPEC.MD`. **Tooling (CLAUDE.md §0):** **Bun**
> (`bun install`, `bunx <bin>`, `bun run <script>`). **Nunca `npm`/`npx`/`yarn`/`pnpm`.**
> **AGENTS.md:** este Next.js tem breaking changes — ler `node_modules/next/dist/docs/` antes
> de codar route handlers/Server Components.

## Dependência de ordem (CLAUDE.md §5.5)

Depende do harness verde das specs 008/009/012 (Vitest/Playwright + Postgres/Redis reais; sync
com client GitHub injetável; tabela `events`). **Internamente faseada** (ver "Ordem de build"):
schema+derivação pura → service CRUD → API → resolver+classifier+atribuição → MCP → UI → docs.
Uma fase só começa com a anterior **verde** (unit→integração→e2e). A 014 (SSE) consome os
eventos `goal.*` desta spec.

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

1. **Vínculo commit→meta:** **LLM decide** (lê o commit e atribui); runtime **plugável**
   OpenAI-compatível (Ollama `:11434/v1`, LM Studio `:1234/v1`, Unsloth) **ou MCP**. **Se o LLM
   ficar offline**, cai para o **determinístico**: keyword `M-12`/`meta #12` → branch vinculada
   → vínculo manual.
2. **Efeito X→Y:** começa em `X` (`start_value`), alvo `Y` (`target_value`); cada commit
   atribuído avança `current_value` até `Y` → concluída. Suporta `0→20` e `20→0`.
3. **Peso por tipo:** commit = 1, merge = 5 (config por env). **CI não conta** como progresso.
4. **Escopo:** **tudo numa spec só** (013), faseada com test gates.
5. **MCP:** **agora**, na mesma spec (stdio; token de serviço → escopo admin; reusa o service).

## Fora de escopo (specs futuras)

- **SSE/realtime** (`/api/stream`, `PUBLISH goals:updates`, EventSource) → **014**. Aqui
  `goal.*` é só gravado em `events`.
- **Atribuição assíncrona/fila** (tirar a classificação do caminho do `POST /sync`) → evolução
  documentada em "Riscos"; aqui é **inline com timeout + fallback**.
- **Pesos por-meta** (override das colunas de peso na `Goal`) — começa **global por env**;
  granularidade fica como evolução aditiva.
- **MCP HTTP/SSE remoto + tokens por-usuário** — aqui só **stdio** + token de serviço (admin).
- **Incidentes/monitoramento** (`incident.*`) — segue futuro.

---

## Arquivos a criar / alterar

### Schema, migração
- **Alterar** `prisma/schema.prisma` — models `Goal`, `GoalBranchLink`, `CommitGoalLink`,
  `GoalCodeCounter` + relações reversas em `Project`/`Commit` (abaixo). Migração
  `bunx prisma migrate dev --name goals_auto_update_mcp` **seguida de** `bunx prisma generate`.
- **Alterar** `tests/setup/db.ts` — `truncateAll` inclui `"goals"` (folha global sem projeto
  não cascateia de `projects`).

### Camada de metas (NOVA) — `src/lib/goals/`
- **`derive.ts`** (puro, unit) — `computePercent`, `applyWeight`, `deriveLeafProgress`,
  `deriveLeafStatus`, `deriveProgress`, `deriveStatus`, `isOverdue`, `deriveTree`; tipos
  `GoalStatus`/`GoalRow`/`DerivedGoal`. **Sem Prisma.**
- **`resolver.ts`** (puro, unit) — `resolveDeterministic(commit, ctx)` (keyword→branch→manual);
  tipos `CandidateGoal`/`DeterministicMatch`.
- **`classifier.ts`** — `interface CommitClassifier`; `createHttpClassifier(cfg, fetchImpl?)`
  (OpenAI-compatível, `AbortController`+timeout, nunca lança p/ fora); `createMcpClassifier(cfg)`;
  `createStubClassifier(map)` + `createOfflineClassifier()` (testes); `resolveClassifier()`
  (env-driven; `none` default → offline).
- **`emit.ts`** (puro, unit) — `goalToEvent(goal, kind, at): EventInput` (`source:"goal"`).
- **`service.ts`** (I/O, integração) — ÚNICO portão Postgres das metas: `listGoals`,
  `createGoal`, `updateGoal`, `archiveGoal`, `linkBranch`, `unlinkBranch`, `linkCommit`,
  `goalOwnerWhere`, `nextShortCode` (contador transacional). Retornos discriminados.
- **`attribution.ts`** (orquestrador, I/O) — `attributeCommits(projectId, newCommits, opts)`:
  para cada commit novo, resolve (LLM→fallback determinístico), aplica peso idempotente
  (`applyWeightIdempotent`), devolve eventos `goal.*`.
- **`DOC.md`** — obrigatório (CLAUDE.md §2).

### Gancho no sync
- **Alterar** `src/lib/github/sync.ts` — assinatura `syncProject(projectId, client?, opts?)`
  (`opts.classifier?`); após o `createMany` dos commits, re-`findMany` os novos (p/ pegar `id`),
  chamar `attributeCommits` em **try/catch próprio** (falha do LLM nunca derruba o sync) e
  concatenar os eventos `goal.*` ao `eventInputs` antes do `db.event.createMany`.
- **Alterar** `src/lib/github/DOC.md`.

### API (App Router)
- **Criar** `src/app/api/goals/route.ts` — `GET` (auth → `listGoals`) + `POST` (admin →
  `createGoal`).
- **Criar** `src/app/api/goals/[id]/route.ts` — `PATCH` (admin → `updateGoal`) + `DELETE`
  (admin → `archiveGoal`). `ctx.params` é **Promise** (Next 16).
- **Criar** `src/app/api/goals/[id]/branch-link/route.ts` — `POST`/`DELETE` (admin).
- **Criar** `src/app/api/goals/[id]/commit-link/route.ts` — `POST` (admin, idempotente).
- **Criar** `DOC.md` de cada pasta nova de API.

### Servidor MCP (NOVO) — `src/lib/mcp/`
- **`auth.ts`** — `resolveScopeFromToken(token): Scope | null` (token de serviço → admin).
- **`tools.ts`** — handlers reutilizáveis (`metasList`/`metasCreate`/`metasUpdate`/
  `metasArchive`/`metasLinkBranch`/`metasLinkCommit`), cada um chamando o **service**.
- **`server.ts`** — `createMetasMcpServer(scope)`: monta `McpServer` e registra as tools (zod).
- **`entry.ts`** — executável (`bun run src/lib/mcp/entry.ts`, `import.meta.main`), transporte
  stdio, fail-closed sem `MCP_SERVICE_TOKEN`, saída limpa em SIGINT/SIGTERM.
- **`DOC.md`**.
- **Alterar** `package.json` — `@modelcontextprotocol/sdk` em `dependencies` + script
  `"mcp": "bun run src/lib/mcp/entry.ts"`.

### Frontend
- **Alterar** `src/app/dashboard/metas/page.tsx` (Server Component) — `requireUser()` +
  `resolveSelectedProject(scope)` + `listGoals(scope, projectId)`; remove `mockGoals`.
- **Alterar** `src/app/dashboard/metas/nova/page.tsx` — passa metas-pai reais + `projectId`.
- **Alterar** `src/components/metas/goal-form.tsx` — `useState` + `fetch('/api/goals')` (sem
  react-hook-form); campos X→Y (start/target/current opcionais) + projeto + vínculo de branch.
- **Alterar** `src/components/metas/{metas-view,goal-row,goal-detail-panel}.tsx` — recursão p/
  profundidade ilimitada; short code, barra X→Y, commits atribuídos; editar/arquivar via `fetch`.
- **Alterar** `src/lib/types.ts` — estende `Goal` (aditivo): `shortCode`, `projectId?`,
  `startValue?/targetValue?/currentValue?`, `percent?`, `derived?`, `attributedCommits?`.
- **Alterar** `src/lib/mock-data.ts` — `mockGoals` deixa de ser consumido pelas páginas
  (documentar como a 012 fez com `mockEvents`).
- **Alterar** os `DOC.md` de `src/components/metas/`, `src/app/dashboard/metas/` (+ `/nova`).

### Env / config
- **Alterar** `src/lib/env.ts` — novas vars (todas opcionais com default; ver "Env").
- **Alterar** `vitest.config.ts` — `test.env` com `LLM_CLASSIFIER_KIND:"none"`, pesos e
  `MCP_SERVICE_TOKEN`.

### Harness de testes
- **Criar** unit: `tests/unit/goals-derive.test.ts`, `goals-resolver.test.ts`,
  `goals-classifier.test.ts`, `goals-emit.test.ts`, `mcp-auth.test.ts`.
- **Criar** integração: `tests/integration/goals-crud.test.ts`, `goals-attribution.test.ts`,
  `goals-mcp.test.ts`.
- **Criar** e2e: `tests/e2e/metas.spec.ts`, `tests/e2e/seed-metas.ts`.
- **Alterar** `tests/e2e/global-setup.ts` — rodar `bun run tests/e2e/seed-metas.ts`.

---

## Mudanças de schema (`prisma/schema.prisma`)

```prisma
/// Meta hierárquica (PRD §4 + spec 013). Folha = progress/status manual (0–100) OU X→Y medível;
/// pai = progress/status DERIVADOS na leitura (read-only, recomputados por deriveTree). project_id
/// como events (nullable = meta global; client só vê metas de projeto próprio via Scope). Soft
/// delete em cascata (deleted_at).
model Goal {
  id           String   @id @default(uuid()) @db.Uuid
  parentId     String?  @map("parent_id") @db.Uuid
  parent       Goal?    @relation("GoalChildren", fields: [parentId], references: [id], onDelete: Cascade)
  children     Goal[]   @relation("GoalChildren")
  projectId    String?  @map("project_id") @db.Uuid
  project      Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  shortCode    String   @map("short_code")                   // M-1, M-2… por projeto (keyword + UI)
  title        String
  description  String?
  status       String   @default("todo")                     // todo | in_progress | done
  progress     Int      @default(0)                           // 0–100 manual só em folha SEM target
  dueDate      DateTime @map("due_date") @db.Date
  startValue   Float?   @map("start_value")                   // X→Y medível (folha). null = manual 0–100
  targetValue  Float?   @map("target_value")
  currentValue Float?   @map("current_value")
  position     Int
  completedAt  DateTime? @map("completed_at")
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  branchLinks  GoalBranchLink[]
  commitLinks  CommitGoalLink[]
  @@unique([projectId, shortCode])
  @@index([parentId])
  @@index([deletedAt])
  @@index([dueDate])
  @@index([projectId])
  @@map("goals")
}

/// Vínculo meta↔branch p/ atribuição determinística (commit na branch / merge dela → meta).
model GoalBranchLink {
  id         String   @id @default(uuid()) @db.Uuid
  goalId     String   @map("goal_id") @db.Uuid
  goal       Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  projectId  String   @map("project_id") @db.Uuid
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  branchName String   @map("branch_name")
  createdAt  DateTime @default(now()) @map("created_at")
  @@unique([projectId, branchName])
  @@index([goalId])
  @@map("goal_branch_links")
}

/// Aplicação IDEMPOTENTE de 1 commit a 1 meta. @@unique([commitId, goalId]) impede double-count
/// em re-sync. Guarda o peso aplicado e o método (auditoria).
model CommitGoalLink {
  id           String   @id @default(uuid()) @db.Uuid
  commitId     String   @map("commit_id") @db.Uuid
  commit       Commit   @relation(fields: [commitId], references: [id], onDelete: Cascade)
  goalId       String   @map("goal_id") @db.Uuid
  goal         Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)
  weight       Float
  method       String                                        // llm | keyword | branch | manual
  appliedValue Float?   @map("applied_value")
  createdAt    DateTime @default(now()) @map("created_at")
  @@unique([commitId, goalId])
  @@index([goalId])
  @@map("commit_goal_links")
}

/// Sequência por projeto p/ o short code (M-N), via UPDATE ... RETURNING transacional.
model GoalCodeCounter {
  projectId String  @id @map("project_id") @db.Uuid
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  next      Int     @default(1)
  @@map("goal_code_counters")
}
```
`Project` ganha `goals Goal[]`, `goalBranchLinks GoalBranchLink[]`, `goalCodeCounter GoalCodeCounter?`.
`Commit` ganha `goalLinks CommitGoalLink[]`.

**Notas:** metas criadas pela UI **sempre têm `projectId`** (seletor do header); meta global
(`projectId NULL`) é caso de borda fora da UI e **não** participa de atribuição. `@@unique([projectId, shortCode])`
não colide entre metas globais no Postgres (NULL distinto) — aceitável, pois globais não têm
short code de UI.

### `syncProject` — gancho de atribuição

`syncProject(projectId, client?, opts?: { classifier?: CommitClassifier })`. Após o `createMany`
dos commits e o cálculo de `commitEvents` (lista filtrada de novos), **antes** do
`db.event.createMany`:
```
const newShas = commitRows.filter(c => !existingShas.has(c.sha)).map(c => c.sha);
let goalEvents: EventInput[] = [];
if (newShas.length > 0) {
  try {
    const rows = await db.commit.findMany({
      where: { projectId, sha: { in: newShas } },
      select: { id, sha, message, isMerge },
    });
    goalEvents = await attributeCommits(
      projectId,
      rows.map(r => ({ ...r, branch: defaultBranch })),
      { classifier: opts?.classifier },
    );
  } catch (err) {
    console.error("[attrib] falhou; sync segue sem atribuição:", err); // resiliência
  }
}
const eventInputs = [...commitEvents, ...runEvents, ...goalEvents];
```

---

## Pipeline de atribuição & X→Y (contratos)

### `derive.ts` (puro)
```ts
export type GoalStatus = "todo" | "in_progress" | "done";
export interface GoalRow {
  id: string; parentId: string | null; shortCode: string; title: string;
  status: GoalStatus; progress: number; dueDate: Date;
  startValue: number | null; targetValue: number | null; currentValue: number | null;
  position: number;
}
export interface DerivedGoal extends Omit<GoalRow, "children"> {
  percent: number; overdue: boolean; derived: boolean; children: DerivedGoal[];
}
computePercent(start, target, current): number   // |Δ|; asc 0→20 e desc 20→0; clamp 0..100; anti /0
applyWeight(start, target, current, weight): number // dir=sign(target-start); clampa no alvo
deriveLeafProgress(leaf): number                  // com target → computePercent; sem → progress
deriveLeafStatus(leaf): GoalStatus                // com target → done se percent>=100; senão status
deriveProgress(childDerivedProgress[]): number    // média simples arredondada (0 se vazio)
deriveStatus(childDerivedStatus[]): GoalStatus    // all done→done; all todo→todo; senão in_progress
isOverdue(dueDate, status, now): boolean          // due no passado E status≠done
deriveTree(rows, now): DerivedGoal[]              // monta árvore e deriva bottom-up; derived=true em pai
```

### `resolver.ts` (puro)
```ts
export interface CandidateGoal { id: string; shortCode: string; title: string; description?: string | null; }
export interface DeterministicMatch { goalId: string; method: "keyword" | "branch" | "manual"; }
resolveDeterministic(
  commit: { message: string; branch: string; isMerge: boolean },
  ctx: { candidates: CandidateGoal[]; branchLinks: { branchName: string; goalId: string }[]; manualGoalId?: string | null },
): DeterministicMatch | null
// keyword: /\bM-(\d+)\b/i ou /\bmeta #(\d+)\b/i → shortCode "M-<n>" entre candidates
// branch:  link.branchName === commit.branch  OU  (commit.isMerge && commit.message inclui branchName)
// manual:  manualGoalId presente
// precedência keyword > branch > manual; nada → null
```

### `classifier.ts`
```ts
export type ClassifyResult =
  | { ok: true; goalId: string | null }
  | { ok: false; error: "unreachable" | "timeout" | "bad_response" };
export interface CommitClassifier { classify(input: ClassifyInput): Promise<ClassifyResult>; }
// createHttpClassifier(cfg, fetchImpl=fetch): POST cfg.baseUrl + "/chat/completions"; valida que o
//   goalId está nos candidates (senão bad_response); AbortController+timeout → timeout; erro de rede
//   → unreachable. NUNCA lança p/ fora.
// createStubClassifier(map: Record<sha, string|null>): {ok:true, goalId: map[sha] ?? null}
// createOfflineClassifier(): sempre {ok:false, error:"unreachable"}
// resolveClassifier(): env.LLM_CLASSIFIER_KIND (http|mcp|none); none → createOfflineClassifier()
```

### `attribution.ts`
```
attributeCommits(projectId, newCommits[{id,sha,message,author,isMerge,branch}], opts):
  candidates = folhas ATIVAS do projeto com short code; se vazio → [] (no-op)
  branchLinks = links do projeto
  classifier = opts.classifier ?? resolveClassifier()
  para cada c:
    det = resolveDeterministic(c, {candidates, branchLinks})              // hint p/ o LLM
    r   = await classifier.classify({ commit:c, candidates, hint:det })
    goalId,method = (r.ok && r.goalId) ? (r.goalId,"llm")
                  : det ? (det.goalId, det.method) : (null,—)            // FALLBACK offline
    se !goalId: continua (log)
    weight = c.isMerge ? GOAL_WEIGHT_MERGE : GOAL_WEIGHT_COMMIT
    applied = applyWeightIdempotent(c.id, goalId, weight, method)         // ↓
    se applied: events.push(goalToEvent(applied.goal, applied.completed?"completed":"updated", c.committedAt? ... : now))
  retorna events
applyWeightIdempotent(commitId, goalId, weight, method):
  count = createMany([{commitId,goalId,weight,method}], skipDuplicates).count
  se count===0: return null                                              // já aplicado (re-sync)
  leaf = goals.find(goalId)
  next = applyWeight(leaf.startValue, leaf.targetValue, leaf.currentValue, weight)
  done = next === leaf.targetValue (na direção do alvo)
  update goals: currentValue=next, status= done?"done":"in_progress", completedAt= done?now:null
  update commit_goal_links.appliedValue = next
  return { goal, completed: done }
```

---

## Impacto em PRD/SPEC e DOC.md

### `.docs/PRD.md` (§4 Metas)
- Nova **§4.7 "Metas medíveis (X→Y)"**: folha pode carregar `start/target/current`; progresso
  derivado de `|Δ|`; atingir o alvo → `done`. Folha sem alvo segue manual 0–100.
- Nova **§4.8 "Código curto (M-N)"**: sequencial por projeto; usado na keyword e na UI.
- Nova **§4.9 "Atualização automática por commits"**: commits sincronizados são atribuídos a
  metas (LLM decide; fallback determinístico keyword/branch/manual; idempotente; pesos
  commit=1/merge=5; **CI excluído**).
- **§11 (tabela de eventos)**: passa a listar `goal.created`/`goal.updated`/`goal.completed`/
  `goal.archived` como **emitidos** (no sync e nas mutações).

### `.docs/SPEC.MD`
- **§2.3 `goals`**: ganha `project_id`, `short_code`, `start_value`/`target_value`/
  `current_value`; novas tabelas `goal_branch_links`, `commit_goal_links`, `goal_code_counters`
  (nova **§2.9**).
- **§4 (API)**: documenta `GET/POST /api/goals`, `PATCH/DELETE /api/goals/:id`, `branch-link`,
  `commit-link` (implementa o que §4 reservava p/ metas + extras).
- **§5 (Metas — algoritmos)**: **§5.5 "X→Y"** (`computePercent`/`applyWeight`), **§5.6
  "Atribuição automática"** (resolver + classifier + idempotência via `commit_goal_links`),
  **§5.7 "Short code"** (contador transacional).
- **Nova §13 "MCP server"**: entrypoint, transporte stdio, auth (token → admin), tools, reuso do
  service.
- **§7 (GitHub)**: `syncProject` agora também atribui commits a metas (gancho nos commits novos)
  → emite `goal.*`.

### `CLAUDE.md` §0 (Stack travada)
- Registrar as decisões aprovadas: **`@modelcontextprotocol/sdk`** (servidor MCP) promovido de
  transitivo a `dependencies`; **classificador LLM OpenAI-compatível via `fetch` nativo** (sem
  SDK de LLM novo — coerente com "sem Octokit"); runtime externo/opcional (Ollama/LM Studio/
  Unsloth), default `none` (offline). Novo script `mcp`. Classificador **nunca** é exigido em teste.

### DOC.md (CLAUDE.md §2)
- **Criar:** `src/lib/goals/DOC.md`, `src/lib/mcp/DOC.md`, `src/app/api/goals/DOC.md` (+ subpastas
  `[id]`, `branch-link`, `commit-link`).
- **Atualizar:** `src/lib/DOC.md` (nova pasta `goals/` + `mcp/`), `src/lib/github/DOC.md` (gancho),
  `src/app/api/DOC.md`, `src/components/metas/DOC.md`, `src/app/dashboard/metas/DOC.md` (+ `/nova`).

---

## Env (`src/lib/env.ts` + `vitest.config.ts`)

Todas opcionais com default (não quebram o boot atual):
```
LLM_CLASSIFIER_KIND       z.enum(["http","mcp","none"]).default("none")
LLM_CLASSIFIER_BASE_URL   z.string().url().optional()
LLM_CLASSIFIER_MODEL      z.string().optional()
LLM_CLASSIFIER_API_KEY    z.string().optional()
LLM_CLASSIFIER_TIMEOUT_MS z.coerce.number().int().positive().default(4000)
GOAL_WEIGHT_COMMIT        z.coerce.number().default(1)
GOAL_WEIGHT_MERGE         z.coerce.number().default(5)
MCP_SERVICE_TOKEN         z.string().min(16).optional()   // obrigatório p/ INICIAR o MCP (fail-closed)
MCP_TRANSPORT             z.enum(["stdio","http"]).default("stdio")
MCP_HTTP_PORT             z.coerce.number().int().positive().optional()
```
`vitest.config.ts` `test.env`: `LLM_CLASSIFIER_KIND:"none"`, `GOAL_WEIGHT_COMMIT:"1"`,
`GOAL_WEIGHT_MERGE:"5"`, `MCP_SERVICE_TOKEN:"test-mcp-token-aaaaaaaa"`.

---

## Desenho dos testes

`test_levels: [unit, integration, e2e]`. **Infra real (§5.3):** Postgres/Redis reais; o **único
externo é o LLM** → stubado por **injeção** (`createStubClassifier`/`createOfflineClassifier` e
`fetch` injetado no `createHttpClassifier`). `LLM_CLASSIFIER_KIND=none` no teste garante o caminho
determinístico. Limpeza por `truncateAll` (agora com `goals`).

**Passo vermelho (§5.4):** criar `derive.ts`/`resolver.ts`/`classifier.ts`/`emit.ts`/`service.ts`/
`attribution.ts`/`mcp/*` como **sentinelas** (puros devolvem neutro: `computePercent`→0,
`applyWeight`→`current`, `deriveStatus`→`"todo"`, `deriveProgress`→0, `isOverdue`→false,
`deriveTree`→`[]`, `resolveDeterministic`→null, `goalToEvent`→`{} as EventInput`,
`resolveScopeFromToken`→null; `service` lança/retorna vazio; `attributeCommits`→`[]`) → rodar →
**falham nas asserções concretas** → `status: tests-red` → implementar até verde **sem alterar os
testes**. Validar 1× quebrando a unique `(commitId, goalId)` de propósito (re-sync passa a
duplicar) p/ confirmar que `goals-attribution` pega o double-count.

### Casos — Unit (resumo; código abaixo)
| arquivo | foco | bordas obrigatórias |
|---|---|---|
| `goals-derive` | X→Y + derivação | asc/desc, overshoot clampa, start===target, sem filhos, todos done→pai done, todos todo, misto→in_progress, profundidade 3, overdue |
| `goals-resolver` | resolver | keyword `M-12`/`meta #12`, branch (merge inclui nome), manual, precedência, nada→null |
| `goals-classifier` | classifier | stub válido; goalId fora dos candidates→`bad_response`; fetch timeout→`timeout`; rede off→`unreachable` |
| `goals-emit` | `goalToEvent` | updated/completed/created/archived (shape, refId, detail) |
| `mcp-auth` | token | válido→admin; errado→null; ausente→null |

### Casos — Integração (Postgres real, LLM stubado)
- **`goals-crud`**: short code sequencial M-1/M-2 por projeto; `position` = max+1 entre irmãos;
  escopo (admin vê tudo; client só os seus; meta alheia → `not_found`); editar progress/status em
  **pai com filhos** → `has_children`; status→done seta `completedAt`, sair de done limpa;
  `archiveGoal` cascateia p/ filhos e some do `listGoals`; deletar o projeto cascateia metas.
- **`goals-attribution`** (núcleo): stub atribui sha→goal → cria `CommitGoalLink`, move
  `current_value` por peso, emite `goal.updated`; **offline** (`createOfflineClassifier`) cai p/
  keyword (`M-1`)/branch/manual; **merge** → peso 5; atingir o alvo → `done` + `goal.completed` +
  `completedAt`; **double-sync não duplica** (link/`current_value` estáveis, sem reemissão); commit
  sem match → unassigned, sem link, sync ok e ainda emite `commit.created`; classifier que **lança**
  não derruba o sync.
- **`goals-mcp`**: `metasCreate`/`metasList` via tools refletem o service; `metasLinkCommit`
  idempotente; tool com scope `null` recusa.

### Casos — E2E (Playwright, DB pré-semeado por `seed-metas`)
- **admin** em `/dashboard/metas`: vê **M-1** "Entregar login" com barra X→Y **em progresso** (1/2)
  e o commit atribuído na atividade; vê **M-2** "Publicar v1" como **Concluído**.
- **admin cria meta** com alvo pelo formulário → aparece com novo short code e barra X→Y.
- **cliente** em `/dashboard/metas` **não** vê as metas do projeto do admin (escopo), sem botões de
  mutação.

---

## Os testes (código)

> Escritos para **falhar** antes da feature existir. Vitest/Playwright importados explicitamente
> (sem globals), casando com o Biome.

### `tests/setup/db.ts` (alterar `truncateAll`)
```ts
export async function truncateAll(): Promise<void> {
  // `projects` CASCADE limpa commits/branches/workflow_runs/events/goals/links; `goals` é nomeado
  // à parte p/ zerar também metas globais (project_id NULL) sem pai p/ cascatear.
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "users", "projects", "events", "goals" RESTART IDENTITY CASCADE`,
  );
}
```

### `tests/unit/goals-derive.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  applyWeight,
  computePercent,
  deriveProgress,
  deriveStatus,
  deriveTree,
  type GoalRow,
  isOverdue,
} from "@/lib/goals/derive";

describe("computePercent (X→Y, |Δ|, clamp)", () => {
  it("ascendente 0→20", () => {
    expect(computePercent(0, 20, 5)).toBe(25);
    expect(computePercent(0, 20, 10)).toBe(50);
  });
  it("descendente 20→0", () => {
    expect(computePercent(20, 0, 15)).toBe(25);
    expect(computePercent(20, 0, 0)).toBe(100);
  });
  it("overshoot clampa em 100", () => expect(computePercent(0, 20, 25)).toBe(100));
  it("start===target: 100 se atingiu, senão 0", () => {
    expect(computePercent(5, 5, 5)).toBe(100);
    expect(computePercent(5, 5, 3)).toBe(0);
  });
});

describe("applyWeight (move na direção do alvo, clampa)", () => {
  it("ascendente soma e clampa no alvo", () => {
    expect(applyWeight(0, 20, 5, 5)).toBe(10);
    expect(applyWeight(0, 20, 18, 5)).toBe(20); // não passa de 20
  });
  it("descendente subtrai e clampa no alvo", () => {
    expect(applyWeight(20, 0, 8, 5)).toBe(3);
    expect(applyWeight(20, 0, 3, 5)).toBe(0); // não passa de 0
  });
});

describe("deriveProgress / deriveStatus (pai)", () => {
  it("média simples dos filhos", () => expect(deriveProgress([0, 50, 100])).toBe(50));
  it("sem filhos → 0", () => expect(deriveProgress([])).toBe(0));
  it("todos done → done", () => expect(deriveStatus(["done", "done"])).toBe("done"));
  it("todos todo → todo", () => expect(deriveStatus(["todo", "todo"])).toBe("todo"));
  it("misto → in_progress", () => {
    expect(deriveStatus(["todo", "done"])).toBe("in_progress");
    expect(deriveStatus(["in_progress", "todo"])).toBe("in_progress");
  });
});

describe("isOverdue", () => {
  const now = new Date(2026, 5, 19, 12, 0);
  it("passado + não-done → true", () =>
    expect(isOverdue(new Date(2026, 5, 10), "todo", now)).toBe(true));
  it("passado + done → false", () =>
    expect(isOverdue(new Date(2026, 5, 10), "done", now)).toBe(false));
  it("futuro → false", () =>
    expect(isOverdue(new Date(2026, 6, 1), "todo", now)).toBe(false));
});

describe("deriveTree (bottom-up, profundidade 3)", () => {
  const due = new Date(2026, 11, 31);
  const leaf = (id: string, parentId: string | null, over: Partial<GoalRow>): GoalRow => ({
    id, parentId, shortCode: id, title: id, status: "todo", progress: 0, dueDate: due,
    startValue: null, targetValue: null, currentValue: null, position: 0, ...over,
  });
  it("deriva pai e avô a partir das folhas", () => {
    const now = new Date(2026, 5, 19);
    const rows: GoalRow[] = [
      leaf("g1", null, {}),
      leaf("g2", "g1", {}),
      leaf("g4", "g2", { startValue: 0, targetValue: 10, currentValue: 10 }), // 100% / done
      leaf("g5", "g2", { startValue: 0, targetValue: 10, currentValue: 0 }),  // 0% / todo
      leaf("g3", "g1", { progress: 40, status: "in_progress" }),              // manual
    ];
    const tree = deriveTree(rows, now);
    const g1 = tree.find((g) => g.id === "g1");
    const g2 = g1?.children.find((g) => g.id === "g2");
    const g4 = g2?.children.find((g) => g.id === "g4");
    expect(g4?.percent).toBe(100);
    expect(g4?.status).toBe("done");
    expect(g2?.progress).toBe(50);          // média(100,0)
    expect(g2?.status).toBe("in_progress"); // misto done+todo
    expect(g2?.derived).toBe(true);
    expect(g1?.progress).toBe(45);          // média(50,40)
    expect(g1?.status).toBe("in_progress");
    expect(g1?.derived).toBe(true);
  });
});
```

### `tests/unit/goals-resolver.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { type CandidateGoal, resolveDeterministic } from "@/lib/goals/resolver";

const candidates: CandidateGoal[] = [
  { id: "goal-12", shortCode: "M-12", title: "Login" },
  { id: "goal-3", shortCode: "M-3", title: "Pagamentos" },
];

describe("resolveDeterministic", () => {
  it("keyword M-12 no message → goal-12", () => {
    const m = resolveDeterministic(
      { message: "feat: oauth (M-12)", branch: "main", isMerge: false },
      { candidates, branchLinks: [] },
    );
    expect(m).toEqual({ goalId: "goal-12", method: "keyword" });
  });
  it("keyword 'meta #3' → goal-3", () => {
    const m = resolveDeterministic(
      { message: "fix: meta #3 corrige taxa", branch: "main", isMerge: false },
      { candidates, branchLinks: [] },
    );
    expect(m?.goalId).toBe("goal-3");
  });
  it("branch: merge cujo título inclui a branch vinculada", () => {
    const m = resolveDeterministic(
      { message: "Merge pull request #9 from o/feature-login", branch: "main", isMerge: true },
      { candidates, branchLinks: [{ branchName: "feature-login", goalId: "goal-12" }] },
    );
    expect(m).toEqual({ goalId: "goal-12", method: "branch" });
  });
  it("manual quando passado e sem keyword/branch", () => {
    const m = resolveDeterministic(
      { message: "chore: nada", branch: "main", isMerge: false },
      { candidates, branchLinks: [], manualGoalId: "goal-3" },
    );
    expect(m).toEqual({ goalId: "goal-3", method: "manual" });
  });
  it("precedência keyword > branch > manual", () => {
    const m = resolveDeterministic(
      { message: "feat (M-3) merge", branch: "main", isMerge: true },
      { candidates, branchLinks: [{ branchName: "main", goalId: "goal-12" }], manualGoalId: "goal-12" },
    );
    expect(m?.method).toBe("keyword");
    expect(m?.goalId).toBe("goal-3");
  });
  it("nada casa → null", () => {
    expect(
      resolveDeterministic(
        { message: "chore: bump", branch: "main", isMerge: false },
        { candidates, branchLinks: [] },
      ),
    ).toBeNull();
  });
});
```

### `tests/unit/goals-classifier.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  type CandidateGoal,
  createHttpClassifier,
  createOfflineClassifier,
  createStubClassifier,
} from "@/lib/goals/classifier";

const candidates: CandidateGoal[] = [{ id: "g1", shortCode: "M-1", title: "X" }];
const input = {
  commit: { sha: "a1", message: "feat", author: "Ana", isMerge: false, branch: "main" },
  candidates,
  hint: null,
};

// resposta OpenAI-compatível com o conteúdo do assistant em JSON
const chat = (content: string) =>
  ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) }) as Response;

describe("createStubClassifier / offline", () => {
  it("stub devolve o goalId mapeado", async () => {
    const c = createStubClassifier({ a1: "g1" });
    expect(await c.classify(input)).toEqual({ ok: true, goalId: "g1" });
  });
  it("offline sempre unreachable", async () => {
    expect(await createOfflineClassifier().classify(input)).toEqual({ ok: false, error: "unreachable" });
  });
});

describe("createHttpClassifier (fetch injetado)", () => {
  const cfg = { baseUrl: "http://x/v1", model: "m", timeoutMs: 50 };
  it("goalId válido entre os candidates → ok", async () => {
    const c = createHttpClassifier(cfg, async () => chat('{"goalId":"g1"}'));
    expect(await c.classify(input)).toEqual({ ok: true, goalId: "g1" });
  });
  it("goalId fora dos candidates → bad_response", async () => {
    const c = createHttpClassifier(cfg, async () => chat('{"goalId":"zzz"}'));
    expect(await c.classify(input)).toEqual({ ok: false, error: "bad_response" });
  });
  it("timeout (AbortError) → timeout", async () => {
    const c = createHttpClassifier(cfg, async () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    expect(await c.classify(input)).toEqual({ ok: false, error: "timeout" });
  });
  it("erro de rede → unreachable", async () => {
    const c = createHttpClassifier(cfg, async () => {
      throw new TypeError("fetch failed");
    });
    expect(await c.classify(input)).toEqual({ ok: false, error: "unreachable" });
  });
});
```

### `tests/unit/goals-emit.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { goalToEvent } from "@/lib/goals/emit";

const at = new Date("2026-06-15T10:00:00Z");
const goal = { id: "g1", projectId: "p1", shortCode: "M-1", title: "Entregar login", currentValue: 10, targetValue: 20 };

describe("goalToEvent", () => {
  it("updated → goal.updated com detail current/target", () => {
    expect(goalToEvent(goal, "updated", at)).toEqual({
      source: "goal", type: "goal.updated", refId: "g1", projectId: "p1",
      title: "Entregar login", detail: "M-1 · 10/20", visibleToClient: true, createdAt: at,
    });
  });
  it("completed → goal.completed", () => {
    const ev = goalToEvent({ ...goal, currentValue: 20 }, "completed", at);
    expect(ev.type).toBe("goal.completed");
    expect(ev.detail).toBe("M-1 · concluída");
  });
  it("created/archived mantêm refId e título", () => {
    expect(goalToEvent(goal, "created", at).type).toBe("goal.created");
    expect(goalToEvent(goal, "archived", at).type).toBe("goal.archived");
  });
});
```

### `tests/unit/mcp-auth.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { resolveScopeFromToken } from "@/lib/mcp/auth";

// vitest.config.ts test.env: MCP_SERVICE_TOKEN = "test-mcp-token-aaaaaaaa"
describe("resolveScopeFromToken", () => {
  it("token válido → escopo admin", () =>
    expect(resolveScopeFromToken("test-mcp-token-aaaaaaaa")).toEqual({ role: "admin" }));
  it("token errado → null", () => expect(resolveScopeFromToken("nope")).toBeNull());
  it("ausente → null", () => expect(resolveScopeFromToken(undefined)).toBeNull());
});
```

### `tests/integration/goals-crud.test.ts`
```ts
import { expect, it } from "vitest";
import { archiveGoal, createGoal, listGoals, updateGoal } from "@/lib/goals/service";
import { db } from "@/lib/db";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function projectOf(role: "admin" | "client" = "admin") {
  const u = await seedUser({ email: `${role}-${Math.round(Math.abs(Math.sin(1)) * 1)}@x.com`.replace("0", role), password: "p", role });
  const p = await createProject({ userId: u.id, name: "P", owner: "o", repo: role });
  if (!p.ok) throw new Error("setup");
  return { user: u, project: p.project };
}

it("short code sequencial M-1/M-2 por projeto e position incremental", async () => {
  const { project } = await projectOf("admin");
  const a = await createGoal(ADMIN, { projectId: project.id, title: "A", dueDate: future() });
  const b = await createGoal(ADMIN, { projectId: project.id, title: "B", dueDate: future() });
  if (!a.ok || !b.ok) throw new Error("create");
  expect(a.goal.shortCode).toBe("M-1");
  expect(b.goal.shortCode).toBe("M-2");
  expect(b.goal.position).toBeGreaterThan(a.goal.position);
});

it("escopo: cliente vê só as suas; meta alheia → not_found", async () => {
  const admin = await projectOf("admin");
  const client = await projectOf("client");
  await createGoal(ADMIN, { projectId: admin.project.id, title: "do admin", dueDate: future() });
  const mine = await createGoal(asClient(client.user.id), {
    projectId: client.project.id, title: "do client", dueDate: future(),
  });
  if (!mine.ok) throw new Error("create");
  const seen = await listGoals(asClient(client.user.id));
  expect(seen.map((g) => g.title)).toEqual(["do client"]);
  expect(await listGoals(ADMIN)).toHaveLength(2);
  const denied = await updateGoal(asClient(client.user.id), admin.project.id /* not a goal */, { title: "x" });
  expect(denied.ok).toBe(false);
});

it("editar progress/status de PAI com filhos → has_children", async () => {
  const { project } = await projectOf("admin");
  const parent = await createGoal(ADMIN, { projectId: project.id, title: "Pai", dueDate: future() });
  if (!parent.ok) throw new Error("p");
  await createGoal(ADMIN, { projectId: project.id, title: "Filho", dueDate: future(), parentId: parent.goal.id });
  const res = await updateGoal(ADMIN, parent.goal.id, { progress: 80 });
  expect(res).toEqual({ ok: false, error: "has_children" });
});

it("status→done seta completedAt; sair de done limpa", async () => {
  const { project } = await projectOf("admin");
  const g = await createGoal(ADMIN, { projectId: project.id, title: "Folha", dueDate: future() });
  if (!g.ok) throw new Error("g");
  await updateGoal(ADMIN, g.goal.id, { status: "done" });
  expect((await db.goal.findUniqueOrThrow({ where: { id: g.goal.id } })).completedAt).not.toBeNull();
  await updateGoal(ADMIN, g.goal.id, { status: "in_progress" });
  expect((await db.goal.findUniqueOrThrow({ where: { id: g.goal.id } })).completedAt).toBeNull();
});

it("arquivar cascateia e some da árvore; deletar projeto cascateia metas", async () => {
  const { project } = await projectOf("admin");
  const parent = await createGoal(ADMIN, { projectId: project.id, title: "Pai", dueDate: future() });
  if (!parent.ok) throw new Error("p");
  await createGoal(ADMIN, { projectId: project.id, title: "Filho", dueDate: future(), parentId: parent.goal.id });
  await archiveGoal(ADMIN, parent.goal.id);
  expect(await listGoals(ADMIN)).toHaveLength(0);
  expect(await db.goal.count({ where: { deletedAt: null } })).toBe(0);
  await db.project.delete({ where: { id: project.id } });
  expect(await db.goal.count()).toBe(0);
});
```

### `tests/integration/goals-attribution.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { createGoal, linkBranch } from "@/lib/goals/service";
import {
  createOfflineClassifier,
  createStubClassifier,
} from "@/lib/goals/classifier";
import { syncProject } from "@/lib/github/sync";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";
import { ghBranch, ghCommit, ghMerge, makeStubClient } from "../setup/github";

const ADMIN = { role: "admin" } as const;

async function seedProjectWithGoal(over: Partial<{ start: number; target: number }> = {}) {
  const owner = await seedUser({ email: "owner@x.com", password: "p", role: "admin" });
  const p = await createProject({ userId: owner.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" });
  if (!p.ok) throw new Error("setup");
  const g = await createGoal(ADMIN, {
    projectId: p.project.id, title: "Entregar login", dueDate: future(),
    startValue: over.start ?? 0, targetValue: over.target ?? 20, currentValue: over.start ?? 0,
  });
  if (!g.ok) throw new Error("goal");
  return { project: p.project, goal: g.goal };
}

it("stub atribui → cria link, move current_value, emite goal.updated", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "feat: tela de login")], branches: [ghBranch("main", "a1")], runs: [] }),
    { classifier: createStubClassifier({ a1: goal.id }) },
  );
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(1);
  expect(await db.event.count({ where: { type: "goal.updated", refId: goal.id } })).toBe(1);
});

it("offline → fallback por keyword (M-1) no message", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "fix: corrige login (M-1)")], branches: [ghBranch("main", "a1")], runs: [] }),
    { classifier: createOfflineClassifier() },
  );
  const link = await db.commitGoalLink.findFirstOrThrow({ where: { goalId: goal.id } });
  expect(link.method).toBe("keyword");
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(1);
});

it("offline → fallback por branch vinculada (merge inclui o nome)", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await linkBranch(ADMIN, goal.id, "feature-login");
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghMerge("m1", "Merge pull request #4 from o/feature-login")], branches: [ghBranch("main", "m1")], runs: [] }),
    { classifier: createOfflineClassifier() },
  );
  const link = await db.commitGoalLink.findFirstOrThrow({ where: { goalId: goal.id } });
  expect(link.method).toBe("branch");
  expect(link.weight).toBe(5); // merge
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(5);
});

it("atingir o alvo → done + goal.completed + completedAt", async () => {
  const { project, goal } = await seedProjectWithGoal({ start: 0, target: 1 });
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "feat: x")], branches: [ghBranch("main", "a1")], runs: [] }),
    { classifier: createStubClassifier({ a1: goal.id }) },
  );
  const after = await db.goal.findUniqueOrThrow({ where: { id: goal.id } });
  expect(after.currentValue).toBe(1);
  expect(after.status).toBe("done");
  expect(after.completedAt).not.toBeNull();
  expect(await db.event.count({ where: { type: "goal.completed", refId: goal.id } })).toBe(1);
});

it("double-sync não duplica (link e current_value estáveis; sem reemissão)", async () => {
  const { project, goal } = await seedProjectWithGoal();
  const client = makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "feat: login")], branches: [ghBranch("main", "a1")], runs: [] });
  const opts = { classifier: createStubClassifier({ a1: goal.id }) };
  await syncProject(project.id, client, opts);
  await syncProject(project.id, client, opts);
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(1);
  expect(await db.event.count({ where: { type: "goal.updated", refId: goal.id } })).toBe(1);
});

it("sem match → unassigned, sem link, mas commit.created ainda é emitido", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "chore: bump deps")], branches: [ghBranch("main", "a1")], runs: [] }),
    { classifier: createStubClassifier({ a1: null }) }, // LLM diz "nenhuma meta"
  );
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(0);
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(1);
});

it("classifier que lança não derruba o sync (commits persistem)", async () => {
  const { project } = await seedProjectWithGoal();
  const boom = { classify: async () => { throw new Error("kaboom"); } };
  const res = await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1", "feat: x")], branches: [ghBranch("main", "a1")], runs: [] }),
    { classifier: boom },
  );
  expect(res.ok).toBe(true);
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(1);
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(1);
});
```

### `tests/integration/goals-mcp.test.ts`
```ts
import { expect, it } from "vitest";
import { metasCreate, metasLinkCommit, metasList } from "@/lib/mcp/tools";
import { db } from "@/lib/db";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;

it("metasCreate + metasList refletem o service (escopo admin)", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({ userId: u.id, name: "P", owner: "o", repo: "r" });
  if (!p.ok) throw new Error("setup");
  const created = await metasCreate(ADMIN, { projectId: p.project.id, title: "Via MCP", dueDate: future().toISOString() });
  expect(created.shortCode).toBe("M-1");
  const list = await metasList(ADMIN, { projectId: p.project.id });
  expect(list.map((g) => g.title)).toContain("Via MCP");
});

it("metasLinkCommit é idempotente", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({ userId: u.id, name: "P", owner: "o", repo: "r" });
  if (!p.ok) throw new Error("setup");
  const meta = await metasCreate(ADMIN, { projectId: p.project.id, title: "M", dueDate: future().toISOString(), targetValue: 5, startValue: 0 });
  const commit = await db.commit.create({ data: { projectId: p.project.id, sha: "z1", message: "x", author: "Ana", committedAt: new Date() } });
  await metasLinkCommit(ADMIN, { goalId: meta.id, commitSha: "z1" });
  await metasLinkCommit(ADMIN, { goalId: meta.id, commitSha: "z1" });
  expect(await db.commitGoalLink.count({ where: { goalId: meta.id, commitId: commit.id } })).toBe(1);
});
```

### `tests/e2e/seed-metas.ts` (NOVO)
```ts
import { db } from "@/lib/db";

// Pré-seed determinístico das Metas (spec 013). Idempotente por (projectId, shortCode).
// M-1 "Entregar login" 0→2 com 1 commit atribuído (1/2, em progresso);
// M-2 "Publicar v1" 0→1 com 1 commit atribuído (1/1, concluída). Tudo no projeto-vitrine do admin.
async function main() {
  const admin = await db.user.findFirstOrThrow({ where: { email: "admin@mirantes.live" } });
  const project = await db.project.findFirstOrThrow({ where: { userId: admin.id }, orderBy: { createdAt: "asc" } });

  await db.goalCodeCounter.upsert({
    where: { projectId: project.id }, update: {}, create: { projectId: project.id, next: 3 },
  });
  const due = new Date("2026-12-31");
  const m1 = await db.goal.upsert({
    where: { projectId_shortCode: { projectId: project.id, shortCode: "M-1" } },
    update: {}, create: {
      projectId: project.id, shortCode: "M-1", title: "Entregar login", status: "in_progress",
      progress: 0, dueDate: due, startValue: 0, targetValue: 2, currentValue: 1, position: 1,
    },
  });
  const m2 = await db.goal.upsert({
    where: { projectId_shortCode: { projectId: project.id, shortCode: "M-2" } },
    update: {}, create: {
      projectId: project.id, shortCode: "M-2", title: "Publicar v1", status: "done",
      progress: 100, dueDate: due, startValue: 0, targetValue: 1, currentValue: 1, position: 2,
      completedAt: new Date("2026-06-12T10:00:00Z"),
    },
  });
  for (const [goal, sha, msg] of [[m1, "metac001", "feat: tela de login (M-1)"], [m2, "metac002", "feat: release v1 (M-2)"]] as const) {
    const commit = await db.commit.upsert({
      where: { projectId_sha: { projectId: project.id, sha } },
      update: {}, create: { projectId: project.id, sha, message: msg, author: "Ana", committedAt: new Date("2026-06-12T09:00:00Z") },
    });
    await db.commitGoalLink.upsert({
      where: { commitId_goalId: { commitId: commit.id, goalId: goal.id } },
      update: {}, create: { commitId: commit.id, goalId: goal.id, weight: 1, method: "keyword", appliedValue: 1 },
    });
  }
  console.log("[e2e-seed] metas semeadas: M-1 (1/2), M-2 (concluída).");
}

main()
  .catch((error) => { console.error("[e2e-seed-metas] falhou:", error); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
```

### `tests/e2e/metas.spec.ts`
```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin vê metas reais: M-1 em progresso e M-2 concluída", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/metas");
  await expect(page.getByText("Entregar login")).toBeVisible();
  await expect(page.getByText("M-1")).toBeVisible();
  await expect(page.getByText("Publicar v1")).toBeVisible();
  await expect(page.getByText(/Conclu[íi]d/i)).toBeVisible();
});

test("admin cria meta com alvo e ela aparece com short code", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/metas/nova");
  await page.getByLabel(/T[íi]tulo/i).fill("Migrar banco");
  await page.getByLabel(/Alvo/i).fill("5");
  await page.getByRole("button", { name: /Criar|Salvar/i }).click();
  await page.waitForURL("**/dashboard/metas");
  await expect(page.getByText("Migrar banco")).toBeVisible();
  await expect(page.getByText("M-3")).toBeVisible();
});

test("cliente não vê as metas do projeto do admin", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/metas");
  await expect(page.getByText("Entregar login")).toHaveCount(0);
});
```

### `tests/e2e/global-setup.ts` (alterar — acrescentar)
```ts
  // Metas da spec 013: metas reais semeadas no projeto-vitrine do admin (idempotente).
  execSync("bun run tests/e2e/seed-metas.ts", { stdio: "inherit", env });
```

---

## Ordem de build (respeita §5.5)

1. **Schema** `Goal`/`GoalBranchLink`/`CommitGoalLink`/`GoalCodeCounter` +
   `bunx prisma migrate dev --name goals_auto_update_mcp` + `bunx prisma generate`; estender
   `truncateAll` (`goals`).
2. **Env**: `src/lib/env.ts` + `vitest.config.ts` (`test.env`).
3. **`derive.ts`** (sentinela → unit vermelho → verde).
4. **`service.ts`** + **`emit.ts`** → integração **`goals-crud`** + unit `goals-emit`
   (vermelho → verde). Validar 1× quebrando algo (ex.: short code fixo) p/ ver o teste pegar.
5. **REST** `/api/goals*` (handlers + zod + admin gate).
6. **`resolver.ts`** + **`classifier.ts`** → unit `goals-resolver`/`goals-classifier`
   (vermelho → verde); depois **`attribution.ts`** + gancho no `sync.ts` → integração
   **`goals-attribution`**. Validar 1× quebrando a unique `(commitId, goalId)`.
7. **MCP** `mcp/{auth,tools,server,entry}.ts` + `package.json` (dep + script) → unit `mcp-auth`
   + integração `goals-mcp`.
8. **UI**: `types.ts`; `metas/page` + `nova/page`; `metas-view`/`goal-row`/`goal-detail-panel`/
   `goal-form` (reais, recursivos, X→Y); remover consumo de `mockGoals`.
9. **E2E** `seed-metas.ts` + `metas.spec.ts` + `global-setup.ts` (vermelho → verde).
10. **Fechamento**: `.docs/PRD.md` (§4.7–4.9, §11) + `.docs/SPEC.MD` (§2.3/§2.9/§4/§5.5–5.7/§13/§7)
    + `CLAUDE.md` §0; todos os DOC.md; `bunx biome check` + `bun run typecheck`; `status: done`.

## Critérios de pronto

- `Goal` + 3 tabelas auxiliares + migração; PRD §4.7–4.9/§11 e SPEC §2.3/§2.9/§4/§5.5–5.7/§13/§7
  atualizados; CLAUDE.md §0 registra `@modelcontextprotocol/sdk` + classificador LLM externo.
- `syncProject` atribui **commits novos** a metas (LLM decide; offline → keyword/branch/manual),
  move `current_value` por **peso** (commit=1/merge=5), **idempotente** (`commit_goal_links`), emite
  `goal.updated`/`goal.completed`. **CI não move progresso.** Falha do LLM não derruba o sync.
- Derivação de pai (média/`status`), X→Y (`computePercent`/`applyWeight`), overdue e `deriveTree`
  com asserções de valor concreto.
- `/api/goals*` escopado (admin muta; cliente lê só os seus); `archiveGoal` cascateia.
- **MCP** sobe via `bun run mcp` (fail-closed sem token), tools reusam o service.
- UI real (sem `mockGoals`): short code, barra X→Y, commits atribuídos; criar/editar/arquivar.
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres/Redis reais; só o
  LLM stubado (§5.3). `bunx biome check` + `bun run typecheck` limpos; DOC.md atualizados; spec
  `013` **`done`**.

## Verificação

- `bun run test` (filtrando `goals-*`/`mcp-*`) e depois `bun run test:all` verde (Playwright com
  `next dev` **parado** — memória do projeto; seed e2e é flaky no Windows, re-rodar).
- Validar o anti-"teste de mentira" (§5.4): rodar 1× quebrando a unique `(commitId, goalId)` →
  `goals-attribution` (double-sync) deve **falhar**.
- **LLM real (manual, opcional):** subir Ollama/LM Studio, `LLM_CLASSIFIER_KIND=http` +
  `LLM_CLASSIFIER_BASE_URL/MODEL`; commit ambíguo (sem keyword) num repo sincronizado → meta certa
  avança.
- **MCP (manual):** `MCP_SERVICE_TOKEN=... bun run mcp`; conectar o Claude Code (stdio) e chamar
  `metas_list`/`metas_create`/`metas_link_commit`.
- **App real:** `bun run dev` → `/dashboard/metas` mostra metas reais (não mock), short code, barra
  X→Y e commits atribuídos; criar/editar/arquivar funcionam.

---

## Divergências da implementação (registro vivo — CLAUDE.md §3.2)

Implementado conforme o plano; todos os `test_levels` verdes (unit/integração/e2e), Biome e
typecheck limpos. Pequenos ajustes aditivos:

1. **Novo arquivo `src/lib/goals/dto.ts`** (`toGoalDTO`, puro) — não estava na lista de arquivos,
   mas é o ponto único que converte `DerivedGoal`→`Goal` (JSON-safe, `dueDate` `AAAA-MM-DD`) p/ REST,
   MCP e Server Components. Não viola "service é o único portão Postgres" (é puro). `GoalDTO = Goal`
   (o `Goal` de `types.ts`, estendido aditivamente).
2. **`GoalRow` (derive.ts) ganhou `projectId?`/`description?` opcionais** — só viajam ao DTO/UI (não
   entram na derivação); opcionais p/ não exigir os campos no teste unit já aprovado.
3. **MCP `server.ts` precisa de uma ponte de tipos** — o `@modelcontextprotocol/sdk@1.29` resolve
   uma cópia **aninhada** de zod (3.25, v4-core) só p/ os tipos de `registerTool`, enquanto o app usa
   zod 4.4. Os schemas funcionam em **runtime** (mesmo v4-core — verificado por smoke in-memory:
   listTools + callTool ok); a ponte (`register` com cast) resolve só o atrito de tipo. Sem
   `overrides` de dependência (mudança mais invasiva foi evitada).
4. **`createMcpClassifier` é placeholder** (comporta-se como offline) — a fiação de "LLM via MCP como
   cliente" fica como evolução; o default `none` e o caminho `http` cobrem o uso real.
5. **CRUD do service emite `goal.*`** (created/updated/archived) — coerente com PRD §11 ("nas
   mutações"); nenhum teste de contagem de eventos quebra (filtram por tipo/refId).
6. **`mockGoals` segue exportado** — só a **página de Metas** deixou de consumi-lo; os previews do
   dashboard/home (`GoalsList`) ainda usam mock (fora do escopo da 013). Documentado em `lib/DOC.md`.
7. **Anti-teste-de-mentira (§5.4)** validado: com a idempotência desativada de propósito (filtro de
   novos + unique), o teste `double-sync` falhou (`expected 2 to be 1`) e voltou a passar após reverter.
