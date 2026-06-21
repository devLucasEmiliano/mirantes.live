---
id: 020
title: MCP via HTTP (global, por token pessoal, sem .env no cliente)
status: approved        # draft | approved | tests-red | done
test_levels: [integration, e2e]
created: 2026-06-21
---

# 020 — MCP via HTTP

## Objetivo

Expor o servidor MCP de Metas por **HTTP** num route handler do próprio app (`/api/mcp`),
autenticado por **Bearer token pessoal** (spec 019). O usuário roda **um único comando**
(`claude mcp add --transport http …`) — **nada no `.env` do cliente, sem repo local** — e o MCP
opera sobre **todos os projetos do dono do token** (escopo `client`, sem amarra ao repositório
atual). É a **Task D** do roadmap (017 remover-LLM → 019 tokens → **020 HTTP**). **Decisões
aprovadas:** (1) token pessoal → escopo client (mantém o isolamento da 019); (2) **migrar só para
HTTP** — remover o stdio.

### Resultado final (cliente)

```
claude mcp add --transport http mirantes-metas <APP_BASE_URL>/api/mcp \
  --header "Authorization: Bearer mir_seutoken..."
```

## Contexto e justificativa

- **Transporte (SDK 1.29):** `WebStandardStreamableHTTPServerTransport`
  (`@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js`) recebe um `Request` web e
  devolve `Response` → encaixa no route handler. **Stateless** (`sessionIdGenerator: undefined`) +
  `enableJsonResponse: true` (resposta JSON, sem SSE de vida longa). Método:
  `handleRequest(request): Promise<Response>`. Padrão canônico = 1 server + 1 transport **por
  requisição**.
- **Auth:** reusa `resolveScopeFromToken(token)` (`src/lib/mcp/auth.ts:12`, já async) com o token do
  header. Como o header ≠ `env.MCP_SERVICE_TOKEN`, o auto-compare do stdio (019) **não se aplica** —
  e desaparece ao remover o `entry.ts`.
- **Sem amarra ao repo:** a única chamada de git é `detectCurrentRepo()` em
  `project-context.ts:80`, disparada por `resolveProjectId(scope, override?)` sem override. No HTTP
  leria o repo do **servidor** → desligar via opção.
- **Sem middleware** intercepta `/api/mcp` (não há `middleware.ts`).

## Arquivos a criar / alterar

### Desligar git por opção (seam)
- `src/lib/mcp/project-context.ts` — `resolveProjectId(scope, override?, opts?: { detectRepo?: boolean })`:
  sem `override` e `opts.detectRepo === false` → **retorna `null`** (escopo inteiro) sem chamar
  `detectCurrentRepo()`. Default preserva o comportamento atual.
- `src/lib/mcp/tools.ts` — propaga `opts` em `metasList(scope, input, opts?)`,
  `requireProjectId(scope, ref, opts?)`, `resolveGoalId(scope, ref, opts?)` e nos callers internos
  (`metasCreate/Update/Archive/LinkBranch/LinkCommit`). Só repassa o flag.
- `src/lib/mcp/server.ts` — `createMetasMcpServer(scope, opts?: { detectRepo?: boolean })`: cada
  callback de tool repassa `opts` ao handler.

### Route HTTP — `src/app/api/mcp/route.ts` (novo)
- `export const runtime = "nodejs"; export const dynamic = "force-dynamic";`
- Handler único reusado por `POST`/`GET`/`DELETE`:
  1. `const token = request.headers.get("authorization")?.replace(/^Bearer /, "")`;
  2. `const scope = await resolveScopeFromToken(token ?? undefined)`; `null` → `401`;
  3. `const server = createMetasMcpServer(scope, { detectRepo: false });`
  4. `const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });`
  5. `await server.connect(transport); return transport.handleRequest(request);`

### Card de setup (Integrações)
- `src/components/integracoes/mcp-setup-card.tsx` — prop `appBaseUrl: string`. Bloco copiável com o
  comando `claude mcp add --transport http …`: após gerar, embute o token puro real (1×); senão um
  template com `<SEU_TOKEN>` (`data-testid="mcp-setup-command"`). Reusa o botão de cópia já existente.
- `src/app/dashboard/integracoes/page.tsx` — passa `appBaseUrl={env.APP_BASE_URL}`.

### Remover stdio
- Apagar `src/lib/mcp/entry.ts` e `.mcp.json`; remover o script `mcp` de `package.json`; tirar
  `mirantes-metas` de `.claude/settings.local.json`.
- `src/lib/env.ts` — remover `MCP_TRANSPORT` e `MCP_HTTP_PORT` (sem uso). **Manter**
  `MCP_SERVICE_TOKEN` opcional (token admin via header; não é mais fail-closed de boot).

## Mudanças de schema

Nenhuma.

## Impacto em PRD/SPEC e DOC.md

- `.docs/SPEC.md` §13 — reescrever p/ transporte **HTTP** (stateless, Bearer→escopo, sem git no HTTP);
  remover "só stdio". `CLAUDE.md` §0 — bullet MCP: HTTP em `/api/mcp`, stdio/script `mcp` removidos.
  `.env.example` — tirar `MCP_TRANSPORT`/stdio; `MCP_SERVICE_TOKEN` opcional; `APP_BASE_URL` monta o
  comando.
- DOC.md: novo `src/app/api/mcp/DOC.md`; atualizar `src/app/api/DOC.md`, `src/lib/mcp/DOC.md`,
  `src/components/integracoes/DOC.md`, `src/app/dashboard/integracoes/DOC.md`.

## Desenho dos testes

**Infra real (§5.3):** Postgres real. Nada externo a stubar (o git de `detectCurrentRepo` é cortado
pela opção `detectRepo:false`, não stubado).

**Passo vermelho (§5.4):** `tests/integration/mcp-http.test.ts` importa o route inexistente
(`@/app/api/mcp/route`) → red de import; e `resolveProjectId(..., { detectRepo:false })` não compila
até a opção existir. **Break-to-confirm:** trocar `detectRepo:false` por `true` no route faria o caso
de isolamento depender do git remote do servidor (instável) — prova que a opção corta o I/O.

### Integração — `tests/integration/mcp-http.test.ts`

```ts
import { expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { createMcpToken } from "@/lib/mcp/tokens";
import { resolveProjectId } from "@/lib/mcp/project-context";
import { createProject } from "@/lib/projects";
import { metasCreate } from "@/lib/mcp/tools";
import { future, seedUser } from "../setup/db";

const JSON_HEADERS = (token?: string) => ({
  "content-type": "application/json",
  accept: "application/json, text/event-stream",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
});
const initBody = {
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } },
};
const req = (token?: string, body: unknown = initBody) =>
  new Request("http://localhost/api/mcp", {
    method: "POST", headers: JSON_HEADERS(token), body: JSON.stringify(body),
  });

it("sem Bearer → 401; Bearer inválido → 401", async () => {
  expect((await POST(req(undefined))).status).toBe(401);
  expect((await POST(req("mir_naoexiste"))).status).toBe(401);
});

it("token pessoal + initialize → 200 com serverInfo", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token } = await createMcpToken(u.id, "PC");
  const res = await POST(req(token));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.result?.serverInfo?.name).toBeTruthy();
});

it("detectRepo:false → resolveProjectId sem override devolve null (sem git)", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  expect(await resolveProjectId({ role: "admin" }, undefined, { detectRepo: false })).toBeNull();
  // sanity: com override resolve normalmente
  const p = await createProject({ userId: u.id, name: "X", owner: "o", repo: "r" });
  if (!p.ok) throw new Error("setup");
  expect(await resolveProjectId({ role: "admin" }, "o/r", { detectRepo: false })).toBe(p.project.id);
});
```

> A chamada `tools/call` ponta-a-ponta (isolamento por escopo) é coberta pelo **e2e** abaixo (servidor
> real + cliente SDK negocia protocolo) e pela lógica já testada em `goals-mcp.test.ts`. Se o fluxo
> stateless `tools/call` num único POST bastar, adicionar aqui também; senão, sequência
> initialize→notifications/initialized→tools/call.

### E2E — `tests/e2e/mcp-http.spec.ts` (servidor rodando)

Jornada: login → `/dashboard/integracoes` → card "MCP / Claude Code" mostra o comando copiável
(`getByTestId("mcp-setup-command")` contém `claude mcp add --transport http` e a `APP_BASE_URL`).
Depois, via `page.request.post("/api/mcp", { headers, data: initialize })` com o Bearer de um token
gerado → **200** e `serverInfo`. Sem Bearer → **401**. (Opcional: `tools/call metas_projects` só
retorna os projetos do dono.)

## Critérios de pronto

- [ ] `POST/GET/DELETE /api/mcp` autentica por Bearer (token pessoal → client; env admin → admin;
      ausente/inválido → 401) e serve as 7 tools **sem amarra ao git** (`detectRepo:false`).
- [ ] `claude mcp add --transport http …` conecta e opera nos projetos do dono do token, sem `.env`.
- [ ] stdio removido (`entry.ts`, `.mcp.json`, script `mcp`, envs `MCP_TRANSPORT`/`MCP_HTTP_PORT`,
      entry em `.claude/settings.local.json`).
- [ ] Card mostra o comando copiável (token real 1× após gerar; senão `<SEU_TOKEN>`).
- [ ] Testes verdes (vistos vermelhos antes); `bun run typecheck` + `biome check` limpos nos arquivos
      da task.
- [ ] DOC.md/SPEC/CLAUDE/.env.example atualizados; spec marcada `done` (atualizada se divergiu).

## Fora de escopo

- Expiração/rotação automática de tokens; escopos por projeto granulares.
- Status "conectado" ao vivo no card (só o comando copiável entra agora).
- Reabilitar `detectCurrentRepo()` no HTTP (desligado de propósito).
