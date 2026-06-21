# src/app/dashboard/integracoes

## Propósito
Tela de Integrações (spec 009) — **aberta a admin e cliente**: hospeda a conexão da conta do
GitHub (OAuth por usuário) e a gestão dos projetos, **escopadas ao usuário** (cliente vê só os
seus; admin vê todos). É a "irmã" de Configurações, mas sem o gate de admin.

## Estrutura
Uma página.

## Arquivos
- **`page.tsx`** (Server Component, `async`) — gate por `await requireUser()` (**não**
  `requireAdmin`: cliente entra). Lê os dados na DAL: `getConnectionStatus(user.id)` (status da
  conexão GitHub — sem token) e `listProjects(scopeForUser(user))` (projetos do escopo), mapeando
  cada projeto p/ um DTO plano (`ProjectListItem`) com `lastPolledAt` em ISO e `isPublic`
  (spec 016 — home pública `/`; o `ProjectsManager` exibe/edita o toggle "Público"). Monta `conn`
  (`{connected, githubLogin}`) e passa `<GithubConnectionCard connection>` + `<ProjectsManager
  projects connection>`. **Tokens MCP (spec 019):** carrega `listMcpTokens(user.id)`, filtra os
  ativos (`revokedAt === null`), mapeia p/ DTO (`McpTokenItem`, datas ISO) e passa a
  `<McpSetupCard tokens>`. Lê `searchParams.github` (`Promise`) p/ exibir o banner do retorno do
  OAuth: `connected` → sucesso (verde), `error` → falha (vermelho).

## O que NÃO vai aqui
- **`requireAdmin`** — esta tela é de admin **e** cliente; o gate é só de sessão (`requireUser`).
- **Fetch de dados nos componentes filhos** — a leitura na DAL é feita **aqui** (Server
  Component); os cards recebem props e falam com a API via `fetch`/navegação.
- **Token/segredo do GitHub no cliente** — `getConnectionStatus` devolve só status (login),
  nunca o token; a troca/decifra mora nos serviços de `src/lib/github/*` e nas rotas.
- **Escopo "solto"** — a visibilidade por papel vem sempre de `scopeForUser(user)`, não de
  filtragem no cliente.
