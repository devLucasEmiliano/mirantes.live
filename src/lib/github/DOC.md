# src/lib/github

## Propósito
Integração com o GitHub (specs 008 + 009): fluxo OAuth por usuário (token cifrado em
repouso), único ponto HTTP com a API, mapeadores puros do payload e o núcleo de
sincronização idempotente que persiste commits/branches/runs de um projeto no Postgres.
Compartilhado pelo botão manual (API) e pelo worker de polling.

## Estrutura
Arquivos avulsos; sem subpastas. `map.ts` é puro (unit); `sync.ts`/`connection.ts`/`repos.ts` tocam
o banco (integração); `oauth.ts` é o único que fala com o github.com no fluxo OAuth;
`oauth-state.ts` é puro (HMAC, sem rede/estado).

## Arquivos
- **`oauth.ts`** — único módulo que fala com **github.com no fluxo OAuth**: troca o
  `code` por token e busca o perfil. `interface GithubOAuthExchanger`
  (`exchangeCodeForToken(code)` → `OAuthTokenResult`; `fetchGithubUser(token)` →
  `GithubUser`), impl exportada como `githubOAuth`. `fetch` nativo (§0). Honra
  `env.GITHUB_OAUTH_FAKE === "1")` → curto-circuita a rede (token/usuário fake) p/ o e2e.
  Falhas viram `class GithubOAuthError` com mensagem que **nunca** contém secret/code
  (`data.error` é código público do GitHub, ex.: `bad_verification_code`). Depende de
  `@/lib/env`.
- **`oauth-state.ts`** — anti-CSRF do OAuth (SPEC §11), **puro** e **sem estado no
  servidor**, espelhando `auth/cookie.ts`. `createOAuthState(userId, now?)` →
  `<userId>.<nonce>.<expiry>.<HMAC>` (HMAC-SHA256 com `SESSION_SECRET`, TTL 10min);
  `verifyOAuthState(token, now?)` confere a assinatura **time-safe** ANTES de ler o
  payload e checa expiração → `{ userId }` ou `null`. Exporta `OAUTH_STATE_COOKIE`
  (`gg_gh_oauth_state`, httpOnly one-shot) e `OAUTH_STATE_COOKIE_PATH`
  (`/api/github/oauth`, escopo restrito). Depende de `node:crypto` e `@/lib/env`.
- **`connection.ts`** — serviço da conexão OAuth **cifrada por usuário** (1:1 em
  `github_connections`). `connectGithub(userId, input)` cifra o token
  (`crypto/secret`) e faz upsert; `disconnectGithub(userId)` (`deleteMany`, idempotente);
  `getConnectionStatus(userId)` → `ConnectionStatus` com `select` deliberado que
  **nunca** carrega os campos do token; `resolveUserToken(userId)` decifra o token do
  dono p/ uso imediato (sync) e devolve discriminado: `not_connected` (sem row),
  `invalid_token` (decifra lança — integridade do GCM) ou `{ ok:true, token }`. Depende
  de `@/lib/db` e `@/lib/crypto/secret`.
- **`client.ts`** — único ponto HTTP (SPEC §7). `fetch` nativo, **sem Octokit** (§0).
  Tipos `GhCommit`/`GhBranch`/`GhWorkflowRun`/`GhRepository`, interface injetável `GitHubClient`,
  `class GitHubError` e `createGitHubClient(token: string)` — **exige** o token (OAuth, do
  dono do projeto) e retorna **sempre** um `GitHubClient` (sem default de env, sem
  `null`). O token vai **só** no header `Authorization`; nunca em log, URL ou mensagem de
  erro (SPEC §11). Métodos: `getRepo`, `listCommits`, `listBranches`, `listWorkflowRuns`
  (envelope `{ workflow_runs }`) e `listRepos` (`GET /user/repos` — repos da conta do
  usuário p/ o seletor; spec 010). `GhCommit` carrega `parents` (2+ = merge → `commit.merged`).
- **`repos.ts`** — serviço que lista os repos da conta conectada do usuário p/ o seletor de
  projetos (spec 010). `listUserRepos(userId, client?)`: resolve o token do dono PRIMEIRO (sem
  conexão → `not_connected`); depois, se `GITHUB_OAUTH_FAKE` → `FAKE_REPOS` (e2e sem rede),
  senão `createGitHubClient(token).listRepos()` → mapeia p/ `UserRepo`
  (`{owner,repo,fullName,private,defaultBranch}`); `GitHubError` → `github_error`. Cap de 100
  (a entrada manual da UI cobre a cauda). Depende de `client`/`connection`/`env`.
- **`map.ts`** — puro, unit-testável. `mapCommit` (subject = 1ª linha; autor cascata
  nome→login→"desconhecido"; `isMerge` = 2+ parents → evento `commit.merged`),
  `summarizeCommitBatch`, `deriveRunStatus` (status+conclusion →
  badge), `isValidRepoSlug` (charset `A-Za-z0-9._-`), `formatWeeklyDelta`. **Sem** I/O — pode
  ser importado por client components (só `import type` do client.ts, apagado em runtime).
- **`sync.ts`** — `syncProject(projectId, client?)`: `project_not_found` / `not_connected`
  (sem client injetado e o token do dono não resolve via `resolveUserToken(project.userId)`)
  / `github_error`; sucesso → `{ inserted:{commits,branches,runs}, lastSeenSha }`.
  Commits via `createMany(skipDuplicates)` na unique `(project,sha)`; branches upsert
  `(project,name)` + remoção das ausentes; runs upsert `(project,run_id)`; avança
  `lastSeenSha`/`lastPolledAt`. **Emite eventos da Timeline** (spec 012, substitui o antigo
  `// TODO(spec-timeline)`): consulta os SHAs já no banco **antes** do `createMany` (que grava
  `isMerge`) e gera `commit.created`/`commit.merged` (via `commitToEvent`, conforme `isMerge`)
  só p/ os realmente novos; p/ runs faz
  `findUnique`→`shouldEmitRunEvent`→`upsert`, acumulando `ci.run` (via `runToEvent`) apenas na
  **transição p/ `completed`**. **Atribuição de metas (spec 013; determinística desde a spec 016):**
  após o `createMany` dos commits, re-`findMany` os SHAs **novos** e chama `attributeCommits` (de
  `@/lib/goals/attribution`) em **try/catch próprio** (uma falha de atribuição nunca derruba o sync),
  concatenando os eventos `goal.*` ao
  `eventInputs`; ao fim, `db.event.createMany` de todos. Importa de `@/lib/events/emit` e
  `@/lib/goals/*`. **Sem transação/PUBLISH** — o wrapper transacional + `PUBLISH goals:updates`
  entra na spec 014.
- **`worker.ts`** — `runGitHubSyncLoop({ intervalMs })`: percorre `db.project.findMany` chamando
  `syncProject`, loga só contagens (NUNCA o token), sobrevive a erro por-projeto, encerra em
  SIGINT/SIGTERM. **Autostart no boot (spec 016):** arranca junto com o app via
  `src/instrumentation.ts`, além do standalone `bun run src/lib/github/worker.ts` (`worker:github`).
  Exporta helpers **puros** (alvo unit, `tests/unit/github-sync-interval.test.ts`):
  `MIN_INTERVAL_MS` (15s, piso anti-rate-limit), `resolveSyncInterval(raw, fallback, floor?)`
  (override → senão `env.GITHUB_SYNC_INTERVAL_MS`; `undefined`/`NaN`/≤0 → fallback; clampa no piso) e
  `shouldAutostart(runtime, flag)` (só `runtime==="nodejs"` && `flag==="1"`).
  `startGitHubSyncLoopOnce()` dispara o loop **fire-and-forget** com guarda de instância única
  (`Symbol.for` em `globalThis`, sobrevive ao HMR). Loop e autostart são *glue* fino e ficam fora de
  `test_levels`; só os helpers puros têm unit (o núcleo I/O coberto é `syncProject`). Depende de
  `@/lib/db`, `@/lib/env` e `./sync`.
- **`backfill-merges.ts`** — backfill ÚNICO do passado: commits sincronizados ANTES da coluna
  `is_merge` não sabiam ser merge. `backfillCommitMerges(clientFor?)` re-busca 1 página de commits
  por projeto na branch padrão (a MESMA fonte do sync → cobre os commits já no banco), marca
  `Commit.isMerge` por `parents>1` e vira os eventos `commit.created` → `commit.merged`. Idempotente;
  `clientFor` é injetável (stub nos testes), default = token OAuth do dono (projeto sem conexão é
  pulado). Rodado por `bun run db:backfill-merges`. Going-forward o sync já grava `isMerge` — isto é
  só p/ o histórico. Depende de `@/lib/db`, `client` e `connection`.

## O que NÃO vai aqui
- **Sem UI/JSX.** Lógica de servidor + tipos.
- **Sem expor o token** — só no header `Authorization`; jamais em log/resposta/URL. O
  token decifrado por `resolveUserToken` é p/ uso imediato em memória, não p/ devolver.
- **Sem chamar o github.com fora dos pontos certos** — o fluxo OAuth fala só por
  `oauth.ts`; as chamadas de dados, só por `client.ts`.
- **Sem PUBLISH/SSE** — o sync **emite** `commit.created`/`ci.run` (spec 012) e, desde a spec 013,
  `goal.*` (via `attributeCommits`) no Postgres; mas o `PUBLISH goals:updates` + o stream ficam p/
  a spec 014. A regra de atribuição mora em `@/lib/goals/*` (não aqui); os mapeadores puros de
  commit/run e o backfill vivem em `src/lib/events/`.
- **Sem Octokit ou libs novas** — `fetch` nativo (§0).
