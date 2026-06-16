# src/lib/github

## Propósito
Integração com o GitHub (spec 008): único ponto HTTP com a API, mapeadores puros do
payload e o núcleo de sincronização idempotente que persiste commits/branches/runs de um
projeto no Postgres. Compartilhado pelo botão manual (API) e pelo worker de polling.

## Estrutura
Arquivos avulsos; sem subpastas. `map.ts` é puro (unit); `sync.ts` toca o banco (integração).

## Arquivos
- **`client.ts`** — único ponto HTTP (SPEC §7). `fetch` nativo, **sem Octokit** (§0). Tipos
  `GhCommit`/`GhBranch`/`GhWorkflowRun`, interface injetável `GitHubClient`, `class GitHubError`
  e `createGitHubClient(token = env.GITHUB_PAT)` → **null** se não há PAT (chamador trata como
  "sem token", sem rede). O PAT vai **só** no header `Authorization`; nunca em log, URL ou
  mensagem de erro (SPEC §11). Métodos: `getRepo`, `listCommits`, `listBranches`,
  `listWorkflowRuns` (envelope `{ workflow_runs }`).
- **`map.ts`** — puro, unit-testável. `mapCommit` (subject = 1ª linha; autor cascata
  nome→login→"desconhecido"), `summarizeCommitBatch`, `deriveRunStatus` (status+conclusion →
  badge), `isValidRepoSlug` (charset `A-Za-z0-9._-`), `formatWeeklyDelta`. **Sem** I/O — pode
  ser importado por client components (só `import type` do client.ts, apagado em runtime).
- **`sync.ts`** — `syncProject(projectId, client?)`: `project_not_found` / `no_token` (sem
  client e sem PAT) / `github_error`; sucesso → `{ inserted:{commits,branches,runs}, lastSeenSha }`.
  Commits via `createMany(skipDuplicates)` na unique `(project,sha)`; branches upsert
  `(project,name)` + remoção das ausentes; runs upsert `(project,run_id)`; avança
  `lastSeenSha`/`lastPolledAt`. Deixa `// TODO(spec-timeline)` p/ o evento `commit.batch`.
- **`worker.ts`** — `runGitHubSyncLoop({ intervalMs })`: percorre `db.project.findMany` chamando
  `syncProject`, loga só contagens (NUNCA o PAT), sobrevive a erro por-projeto, encerra em
  SIGINT/SIGTERM. Rodado por `bun run src/lib/github/worker.ts` (script `worker:github`). Sem teste
  (fino) — o núcleo coberto é `syncProject`.

## O que NÃO vai aqui
- **Sem UI/JSX.** Lógica de servidor + tipos.
- **Sem expor o PAT** — só no header; jamais em log/resposta/URL.
- **Sem regra de metas/eventos/SSE** — Timeline (evento `commit.batch` + PUBLISH) é spec futura;
  aqui fica só o `// TODO(spec-timeline)`.
- **Sem Octokit ou libs novas** — `fetch` nativo (§0).
