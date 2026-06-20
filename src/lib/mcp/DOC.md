# src/lib/mcp

## Propósito
Servidor **MCP** (Model Context Protocol) de Metas (spec 013): expõe listar/criar/atualizar/
arquivar/vincular metas a ferramentas externas (ex. Claude Code) via **stdio**, reusando o MESMO
`@/lib/goals/service` do REST. Token de serviço → escopo admin (fail-closed).

## Estrutura
`auth.ts` (token → escopo), `project-context.ts` (projeto "atual" via git + resolução), `tools.ts`
(handlers planos sobre o service), `server.ts` (monta o `McpServer` + registra as tools com zod),
`entry.ts` (executável stdio, `bun run mcp`).

## Arquivos
- **`auth.ts`** — `resolveScopeFromToken(token)`: confere o `MCP_SERVICE_TOKEN`; válido → `{ role:
  "admin" }`, senão `null`. Fail-closed.
- **`project-context.ts`** (spec 015) — "projeto atual" do MCP. `parseGitRemote(url)` **puro** (unit):
  `owner/repo` de URLs https/scp-like/`ssh://`; fora do padrão → `null`. `detectCurrentRepo(cwd?)`:
  **único I/O externo** — `git remote get-url origin` (`execFileSync`, stderr descartado, nunca lança)
  → `parseGitRemote`. `resolveProjectId(scope, override?)`: `override` (humano) → `findProjectByRef`
  (`ambiguous`/`not_found` → lança); sem override → git remote → match (repo não cadastrado → `null`
  p/ cair em todo o escopo; `ambiguous` → lança). Não toca Postgres direto (delega ao domínio).
- **`tools.ts`** (spec 013/015) — `metasList`/`metasCreate`/`metasUpdate`/`metasArchive`/
  `metasLinkBranch`/`metasLinkCommit`/`metasProjects`. Projeto vem por `project` (owner/repo|repo|
  name) ou `projectId`, senão pelo git remote (`resolveProjectId`); meta por `goalId` **ou**
  `shortCode` (`resolveGoalId`→`findGoalIdByShortCode`). `metasLinkCommit` resolve `commitSha`→
  `commitId` no projeto da meta; `metasProjects` lista `{ id, name, owner, repo }` do escopo. Erro do
  service vira `throw`. Exercitados direto por `tests/integration/goals-mcp.test.ts`.
- **`server.ts`** — `createMetasMcpServer(scope)`: registra as **7 tools** (zod). Schemas comuns
  `PROJECT_REF`/`GOAL_REF` (`project?`/`projectId?`/`goalId?`/`shortCode?`). O SDK 1.29 traz uma cópia
  aninhada de zod (3.25, v4-core) só p/ tipos; o helper `register` faz a ponte de tipos (o app usa zod
  4.4) — runtime validado pelo próprio SDK.
- **`entry.ts`** — executável (`import.meta.main`): resolve o escopo do token (fail-closed sem
  `MCP_SERVICE_TOKEN`), conecta o `StdioServerTransport`, sai limpo em SIGINT/SIGTERM. Logs em
  **stderr** (stdout é do protocolo).

## O que NÃO vai aqui
- **Sem lógica de metas** — só adapta MCP→`@/lib/goals/service` (single source of truth). A
  resolução de projeto por ref vive no domínio (`@/lib/projects` + `projects/ref.ts`), não aqui.
- **Sem acesso Postgres direto** (salvo a resolução `sha`→`commitId` em `tools.ts`, que é leitura).
  O único I/O **externo** é o `git remote` em `project-context.ts` (stubado nos testes via `override`).
- **Sem HTTP/SSE remoto nem tokens por-usuário** — só stdio + token de serviço (evolução futura).
- Logs **nunca** vão p/ stdout no transporte stdio (corromperia o protocolo).
