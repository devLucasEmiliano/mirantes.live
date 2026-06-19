# src/lib/goals

## Propósito
Camada de **Metas** (spec 013): metas hierárquicas, progresso medível **X→Y**, derivação de pai,
e **atribuição automática commit→meta** (LLM plugável + fallback determinístico). Núcleo
reutilizado pelo REST (`/api/goals*`), pelo MCP (`@/lib/mcp`) e pelos Server Components.

## Estrutura
Puros (unit, sem I/O): `derive.ts`, `resolver.ts`, `emit.ts`, `dto.ts`, `summary.ts`. Com I/O (integração):
`service.ts` (único portão Postgres), `attribution.ts` (orquestrador do sync). `classifier.ts`
fala com o LLM externo via `fetch` injetável (nunca lança).

## Arquivos
- **`derive.ts`** (puro) — regras de cálculo: `computePercent`/`applyWeight` (X→Y, |Δ|, clamp),
  `deriveLeafProgress`/`deriveLeafStatus`, `deriveProgress`/`deriveStatus` (média/agregação do
  pai), `isOverdue`, `deriveTree` (monta a árvore e deriva bottom-up). Tipos `GoalStatus`,
  `GoalRow`, `DerivedGoal`.
- **`resolver.ts`** (puro) — `resolveDeterministic(commit, ctx)`: keyword (`M-12`/`meta #12`) >
  branch (commit na branch / merge cita o nome) > manual. Tipos `CandidateGoal`,
  `DeterministicMatch`.
- **`classifier.ts`** — `CommitClassifier`; `createHttpClassifier` (OpenAI-compatível,
  `AbortController`+timeout, **nunca lança** → erros viram `ClassifyResult`),
  `createStubClassifier`/`createOfflineClassifier` (testes), `createMcpClassifier` (placeholder),
  `resolveClassifier()` (env; default `none` → offline).
- **`emit.ts`** (puro) — `goalToEvent(goal, kind, at): EventInput` (`source:"goal"`), espelha o
  padrão `events/emit.ts`.
- **`service.ts`** (I/O) — **ÚNICO portão Postgres** das metas: `listGoals` (árvore derivada do
  escopo), `createGoal`/`updateGoal`/`archiveGoal` (soft delete em cascata), `linkBranch`/
  `unlinkBranch`, `linkCommit` (manual, idempotente), `goalOwnerWhere`, short code transacional.
  Retornos discriminados `{ ok } | { ok:false; error }` (padrão de `projects.ts`).
- **`attribution.ts`** (I/O) — `attributeCommits(projectId, newCommits, opts)`: roda no `syncProject`
  p/ cada commit NOVO (LLM decide → fallback determinístico), aplica peso idempotente
  (`commit_goal_links` unique), devolve eventos `goal.*`.
- **`dto.ts`** (puro) — `toGoalDTO(DerivedGoal): Goal` (JSON-safe; `dueDate` `AAAA-MM-DD`). Tipo
  único p/ REST, MCP e páginas.
- **`summary.ts`** (puro) — `summarizeGoals(DerivedGoal[]): GoalsSummary` (spec 014). Achata a
  árvore (pais + folhas) e conta por status/`overdue`; `totalProgress` = média dos `percent` de
  **topo** (cada um já é o rollup do seu subarvore); `nextDueDate` = menor `dueDate` (ISO) entre
  nós não-`done`. Alimenta os cards da Visão Geral com os MESMOS números reais da página de Metas.

## O que NÃO vai aqui
- **Nenhum acesso Postgres fora de `service.ts`/`attribution.ts`** — os puros não importam Prisma.
- **Sem JSX / `next/*`** — é domínio, não UI.
- **Sem SSE/PUBLISH** — eventos `goal.*` só são **gravados** em `events` aqui; Redis/SSE → spec 014.
- **LLM nunca é obrigatório** — offline cai no determinístico; o classifier não lança p/ fora.
