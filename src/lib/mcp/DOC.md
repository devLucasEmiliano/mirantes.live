# src/lib/mcp

## Propósito
Servidor **MCP** (Model Context Protocol) de Metas (spec 013): expõe listar/criar/atualizar/
arquivar/vincular metas a ferramentas externas (ex. Claude Code) reusando o MESMO
`@/lib/goals/service` do REST. **Transporte HTTP** no route `@/app/api/mcp` (spec 020) — o **stdio
foi removido** (não há mais `entry.ts`/`bun run mcp`/`.mcp.json`). Auth por token → escopo:
`MCP_SERVICE_TOKEN` (env) → admin, token pessoal (spec 019) → `{ client, userId }`; fail-closed.

## Estrutura
`auth.ts` (token → escopo), `tokens.ts` (tokens pessoais: gerar/hash/CRUD, spec 019),
`project-context.ts` (projeto "atual" via git + resolução, com *seam* p/ desligar o git),
`tools.ts` (handlers planos sobre o service), `server.ts` (monta o `McpServer` + registra as tools
com zod). O transporte vive no route HTTP (`@/app/api/mcp/route.ts`), não aqui.

## Arquivos
- **`auth.ts`** (spec 013 → 019) — `resolveScopeFromToken(token): Promise<Scope | null>`
  (**assíncrono**). Ordem fail-closed: sem token → `null`; `=== env.MCP_SERVICE_TOKEN` (se
  configurado) → `{ role: "admin" }` (compat operador/local); senão `sha256(token)` casa um
  `mcp_tokens` **ativo** → carimba `lastUsedAt` (await) e devolve `{ role: "client", userId }`;
  desconhecido/revogado → `null`. Chamado pelo route HTTP com o Bearer do header.
- **`tokens.ts`** (spec 019) — **única porta ao Postgres** do domínio de tokens. `generateMcpToken()`
  (puro: `mir_` + 43 chars base62 sem viés de módulo + `prefix` curto) e `hashToken()` (puro:
  sha256 hex) são unit; `createMcpToken(userId, name)` grava só hash+prefixo e devolve o texto puro
  **uma vez**; `listMcpTokens(userId)` projeta `McpTokenView` (**sem** `tokenHash`, com `prefix`),
  recentes 1º; `revokeMcpToken(userId, id)` soft-revoga escopado ao dono (alheio → `{ ok: false }`).
  **SHA-256, não argon2:** token é alta entropia → KDF lento não agrega e impede lookup O(1).
- **`project-context.ts`** (spec 015 + 020) — "projeto atual" do MCP. `parseGitRemote(url)` **puro**
  (unit): `owner/repo` de URLs https/scp-like/`ssh://`; fora do padrão → `null`.
  `detectCurrentRepo(cwd?)`: **único I/O externo** — `git remote get-url origin` (`execFileSync`,
  stderr descartado, nunca lança) → `parseGitRemote`. `resolveProjectId(scope, override?, opts?)`:
  `override` (humano) → `findProjectByRef` (`ambiguous`/`not_found` → lança); **`opts.detectRepo ===
  false`** (spec 020) sem override → devolve `null` **sem chamar git** (escopo inteiro); default
  (sem opts) sem override → git remote → match (repo não cadastrado → `null`; `ambiguous` → lança).
  É um *seam*: o transporte HTTP corta o git (do servidor) em vez de stubá-lo. Não toca Postgres.
- **`tools.ts`** (spec 013/015/020) — `metasList`/`metasCreate`/`metasUpdate`/`metasArchive`/
  `metasLinkBranch`/`metasLinkCommit`/`metasProjects`. Projeto vem por `project` (owner/repo|repo|
  name) ou `projectId`, senão pelo git remote (`resolveProjectId`); meta por `goalId` **ou**
  `shortCode` (`resolveGoalId`→`findGoalIdByShortCode`). Todos repassam `opts?: { detectRepo? }` ao
  `resolveProjectId` (HTTP passa `{ detectRepo: false }`). `metasLinkCommit` resolve `commitSha`→
  `commitId` no projeto da meta; `metasProjects` lista `{ id, name, owner, repo }` do escopo. Erro do
  service vira `throw`. Exercitados direto por `tests/integration/goals-mcp.test.ts`.
- **`server.ts`** — `createMetasMcpServer(scope, opts?)`: registra as **7 tools** (zod) e repassa
  `opts` (ex. `{ detectRepo: false }`) a cada handler que resolve projeto. Schemas comuns
  `PROJECT_REF`/`GOAL_REF` (`project?`/`projectId?`/`goalId?`/`shortCode?`). O SDK 1.29 traz uma cópia
  aninhada de zod (3.25, v4-core) só p/ tipos; o helper `register` faz a ponte de tipos (o app usa zod
  4.4) — runtime validado pelo próprio SDK. O transporte/auth ficam no route HTTP (`@/app/api/mcp`).

## O que NÃO vai aqui
- **Sem lógica de metas** — só adapta MCP→`@/lib/goals/service` (single source of truth). A
  resolução de projeto por ref vive no domínio (`@/lib/projects` + `projects/ref.ts`), não aqui.
- **Sem acesso Postgres direto** (salvo a resolução `sha`→`commitId` em `tools.ts`, que é leitura, e
  o domínio de tokens em `tokens.ts`). O único I/O **externo** é o `git remote` em
  `project-context.ts` — desligável por `opts.detectRepo:false` (HTTP) e contornável por `override`.
- **Sem transporte aqui** — HTTP (`WebStandardStreamableHTTPServerTransport`) mora no route
  `@/app/api/mcp/route.ts`. O **stdio foi removido** (spec 020); não há `entry.ts`/script `mcp`.
