# src/app/api/mcp

## Propósito
Route Handler HTTP do **servidor MCP de Metas** (spec 020): expõe as 7 tools de Metas por HTTP em
`/api/mcp`, autenticado por **Bearer token pessoal** (spec 019). Substitui o transporte **stdio**
(removido na spec 020 — não há mais `entry.ts`/`bun run mcp`/`.mcp.json`). O cliente conecta com
**um comando** (`claude mcp add --transport http mirantes-metas <APP_BASE_URL>/api/mcp --header
"Authorization: Bearer mir_…"`), sem `.env` nem repo local.

## Estrutura
Uma rota (`route.ts`). Sem subpastas.

## Arquivos
- **`route.ts`** — `runtime = "nodejs"`, `dynamic = "force-dynamic"`. Um `handle(request)` único é
  reexportado como **`POST`/`GET`/`DELETE`** (mesmo gate p/ os três). Fluxo:
  1. lê o header `Authorization: Bearer <token>` → `resolveScopeFromToken(token)` (`@/lib/mcp/auth`);
     `null` (ausente/inválido) → **401** JSON-RPC;
  2. `createMetasMcpServer(scope, { detectRepo: false })` — **1 server por requisição**; `detectRepo:
     false` desliga o `git remote` do servidor (não faz sentido no HTTP), então as tools operam sobre
     **todo o escopo** do dono do token, salvo `project`/`projectId` explícito;
  3. `WebStandardStreamableHTTPServerTransport` **stateless** (`sessionIdGenerator: undefined`) +
     `enableJsonResponse: true` (responde JSON, sem SSE de vida longa) — **1 transport por
     requisição**;
  4. `await server.connect(transport)` → `return transport.handleRequest(request)` (Web `Request` →
     Web `Response`, encaixa direto no App Router).
  - Em **stateless** cada POST é independente: um `tools/call` num único POST funciona sem handshake
    `initialize` prévio (o SDK não exige init no nível de protocolo; a checagem de sessão é pulada).
    O escopo/IDs ficam isolados porque server+transport nascem por requisição.

## O que NÃO vai aqui
- **Sem sessão por cookie** — a auth é só pelo header `Authorization` (Bearer); a sessão do app não
  conta. Use o **token pessoal** (spec 019) ou o `MCP_SERVICE_TOKEN` (env → admin).
- **Sem lógica de metas** — o route só faz auth + transporte; as tools delegam ao service via
  `@/lib/mcp/server` → `tools.ts` (single source of truth no `@/lib/goals/service`).
- **Sem git do servidor** — `detectRepo: false` corta o `detectCurrentRepo()` de propósito (leria o
  repo do servidor, não o do cliente). Reabilitar está **fora de escopo** (spec 020 §Fora de escopo).
- **Sem segredo na resposta** — 401 devolve só um erro JSON-RPC genérico; nada de token/hash.
