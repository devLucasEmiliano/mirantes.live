---
id: 019
title: Tokens MCP por usuário (Personal Access Tokens) + gestão na Integrações
status: done        # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-21
---

# 019 — Tokens MCP por usuário

## Objetivo

Permitir que **cada usuário** gere **tokens pessoais** que o servidor MCP de Metas resolve para o
escopo `{ role: "client", userId }` — em vez do único `MCP_SERVICE_TOKEN` (admin) de hoje. Com isso,
"diferentes contas de Claude Code" passam a operar **apenas nas metas dos seus próprios projetos**.
Inclui geração/listagem/revogação na tela de **Integrações**. O `MCP_SERVICE_TOKEN` continua válido
como **fallback de operador/local** (escopo admin).

> É a **Task C** do roadmap (remover-LLM 017 → **019 tokens** → 020 MCP-HTTP). A **020** (MCP via
> HTTP no `/api/mcp` + comando de setup) depende desta auth e vem na spec seguinte.

## Contexto e justificativa

- `src/lib/mcp/auth.ts:7` — `resolveScopeFromToken(token)` hoje é **síncrono** e só compara com
  `env.MCP_SERVICE_TOKEN`, devolvendo `{ role: "admin" }` fixo ou `null` (fail-closed).
- `src/lib/projects.ts:18` — `type Scope = { role: "admin" } | { role: "client"; userId: string }`
  **já existe** e todo o domínio (`ownerWhere`/`commitOwnerWhere`/`goalOwnerWhere`,
  `scopeForUser`) já isola por usuário (spec 009). **Não há autorização nova a construir** — só
  mapear um token válido → `{ role: "client", userId }`.
- `createMetasMcpServer(scope)` (`src/lib/mcp/server.ts:66`) e os handlers em `src/lib/mcp/tools.ts`
  já consomem o escopo; nada muda neles.
- `src/lib/mcp/entry.ts` resolve o escopo no boot (stdio). Passa a `await` o resolve (assíncrono).

### Decisão de hashing — **SHA-256, não argon2**

Tokens são **alta entropia** (32 bytes aleatórios), então um KDF lento (argon2, usado em senhas)
**não agrega segurança** e **impede lookup O(1)** (argon2 tem salt por registro → não dá para buscar
por hash). Padrão de API key (ex. GitHub PAT): guardar `tokenHash = sha256(token)` em coluna
**única indexada** e buscar por igualdade exata. O texto puro é exibido **uma vez** e descartado;
no banco só vive o hash + um `tokenPrefix` curto para exibição.

## Dependência de ordem (CLAUDE.md §5.5)

Independente para entrar; **bloqueia a 020** (que reusa `resolveScopeFromToken` assíncrono). Faseado:
unit (utils puros de token) → integração (Postgres real: criar/resolver/revogar + isolamento) →
e2e (UI gerar/revogar).

## Arquivos a criar / alterar

### Schema (nova migração Prisma)

`prisma/schema.prisma` — novo modelo + relação inversa no `User`:

```prisma
model McpToken {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String    // rótulo livre do usuário (ex. "Notebook")
  tokenHash   String    @unique @map("token_hash")   // sha256(token) hex — nunca o texto
  tokenPrefix String    @map("token_prefix")          // ex. "mir_AbC123…" só p/ exibir
  lastUsedAt  DateTime? @map("last_used_at")
  revokedAt   DateTime? @map("revoked_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@map("mcp_tokens")
}
```
No `model User { … }` adicionar: `mcpTokens McpToken[]`. Migração: `bun run db:migrate`
(`bunx prisma migrate dev`). `tests/setup/db.ts::truncateAll` já trunca `users … CASCADE` → cobre
`mcp_tokens` (FK `onDelete: Cascade`); **sem mudança no setup de teste**.

### Criar — `src/lib/mcp/tokens.ts` (única porta ao Postgres do domínio de tokens)

- `generateMcpToken(): { token: string; prefix: string }` — `token = "mir_" + base62(randomBytes(32))`;
  `prefix = token.slice(0, 12) + "…"`. Puro (usa `node:crypto`).
- `hashToken(token: string): string` — `createHash("sha256").update(token).digest("hex")`. Puro.
- `createMcpToken(userId, name): Promise<{ token: string; view: McpTokenView }>` — gera, grava só o
  hash+prefix, devolve o texto **uma vez**.
- `listMcpTokens(userId): Promise<McpTokenView[]>` — `select` **sem** `tokenHash` (id, name, prefix,
  lastUsedAt, revokedAt, createdAt), ordenado por `createdAt desc`.
- `revokeMcpToken(userId, id): Promise<{ ok: boolean }>` — set `revokedAt = now()` escopado ao dono
  (idempotente; `id` alheio → `{ ok: false }`).

### Alterar — `src/lib/mcp/auth.ts`

`resolveScopeFromToken(token?): Promise<Scope | null>` (assíncrono):
1. sem token → `null`;
2. `=== env.MCP_SERVICE_TOKEN` (se configurado) → `{ role: "admin" }` (compat local);
3. senão `db.mcpToken.findUnique({ where: { tokenHash: hashToken(token) } })`; se existe e
   `revokedAt == null` → carimba `lastUsedAt = now()` (**await**, não fire-and-forget, p/
   determinismo de teste) e devolve `{ role: "client", userId }`;
4. desconhecido/revogado → `null`.

### Alterar — `src/lib/mcp/entry.ts`

`const scope = await resolveScopeFromToken(env.MCP_SERVICE_TOKEN)` (mantém fail-closed: `null` →
`process.exit(1)`). Usuário pode pôr seu token pessoal nesse env p/ stdio local escopado.

### Criar — rotas REST (handlers finos, espelham `src/app/api/projects/route.ts`)

- `src/app/api/mcp-tokens/route.ts` — `GET` (lista do `scopeForUser`/`current.id`) e `POST`
  (`{ name }` zod; cria; devolve `{ token, view }` **com o texto uma vez**, `201`). `requireUser`/401.
- `src/app/api/mcp-tokens/[id]/route.ts` — `DELETE` revoga (`revokeMcpToken(current.id, id)`; `200`
  ok / `404` se alheio). `requireUser`/401.

### Criar — `src/components/integracoes/mcp-setup-card.tsx`

Card "MCP / Claude Code" (`"use client"`): lista tokens (rótulo, prefixo, último uso, botão revogar);
botão **Gerar token** → modal/inline mostra o texto puro **uma vez** com copiar
(`data-testid="mcp-token-plaintext"`). Renderizado em `src/app/dashboard/integracoes/page.tsx`
(carrega `listMcpTokens(user.id)` no server component e passa como prop). O **comando de setup**
(`claude mcp add … /api/mcp …`) entra na **020** (depende do endpoint HTTP); nesta 019 o card já
existe e gere os tokens.

## Mudanças de schema

Nova tabela `mcp_tokens` (acima). Nada mais.

## Impacto em PRD/SPEC

- **PRD**: nota de que o MCP passa a ter **tokens por usuário** (multi-conta), além do token de
  serviço local.
- **SPEC (auth do MCP / §env)**: descrever o resolve de escopo por token (admin env → admin; token de
  usuário → client; revogado/desconhecido → recusa) e a tabela `mcp_tokens` (hash em repouso).

## Desenho dos testes

**Infra real (§5.3):** Postgres real na integração (cria token, resolve escopo, revoga, isola por
usuário). Nada externo a stubar. Utils de token (gerar/hash) são puros → unit.

**Passo vermelho (§5.4):** antes de implementar, `tests/integration/mcp-tokens.test.ts` e
`tests/unit/mcp-tokens.test.ts` **não carregam** (import de `@/lib/mcp/tokens` inexistente) → red de
import; e mesmo com o módulo, `resolveScopeFromToken` atual (síncrono, só admin-env) devolve `null`
para um token de usuário → o caso "token válido → client" falha (`expected null to equal {client}`).
Implementado o resolve por hash → verde. **Break-to-confirm** disponível: neutralizar a busca por
hash (retornar `null`) reverte os casos client/revogado ao vermelho, provando que discriminam.

### Unit — `tests/unit/mcp-tokens.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { generateMcpToken, hashToken } from "@/lib/mcp/tokens";

describe("token puro", () => {
  it("gera token com prefixo mir_ e formato esperado", () => {
    const { token, prefix } = generateMcpToken();
    expect(token.startsWith("mir_")).toBe(true);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(/^mir_[0-9A-Za-z]+$/.test(token)).toBe(true);
    expect(prefix.startsWith("mir_")).toBe(true);
    expect(prefix.endsWith("…")).toBe(true);
  });

  it("dois tokens são diferentes (entropia)", () => {
    expect(generateMcpToken().token).not.toBe(generateMcpToken().token);
  });

  it("hashToken é determinístico, sha256 hex (64), e não é o texto puro", () => {
    const { token } = generateMcpToken();
    const h = hashToken(token);
    expect(h).toBe(hashToken(token));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(token);
    expect(hashToken("mir_a")).not.toBe(hashToken("mir_b"));
  });
});
```

### Integração — `tests/integration/mcp-tokens.test.ts`

```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { resolveScopeFromToken } from "@/lib/mcp/auth";
import { createMcpToken, hashToken, listMcpTokens, revokeMcpToken } from "@/lib/mcp/tokens";
import { metasCreate, metasList } from "@/lib/mcp/tools";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const asClient = (userId: string) => ({ role: "client", userId }) as const;

it("createMcpToken grava só o hash+prefixo (texto não persiste) e devolve o texto uma vez", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "Notebook");
  expect(token.startsWith("mir_")).toBe(true);
  const row = await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } });
  expect(row.tokenHash).toBe(hashToken(token));
  expect(row.tokenPrefix).toBe(view.prefix);
  // o texto puro não aparece em nenhuma coluna persistida
  expect(row.tokenHash).not.toBe(token);
  expect(row.tokenPrefix).not.toBe(token);
});

it("resolveScopeFromToken: token de usuário → client+userId e carimba lastUsedAt", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "PC");
  expect(await resolveScopeFromToken(token)).toEqual({ role: "client", userId: u.id });
  const row = await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } });
  expect(row.lastUsedAt).not.toBeNull();
});

it("MCP_SERVICE_TOKEN (env) ainda resolve admin; token desconhecido → null", async () => {
  // vitest.config injeta MCP_SERVICE_TOKEN = "test-mcp-token-aaaaaaaa"
  expect(await resolveScopeFromToken("test-mcp-token-aaaaaaaa")).toEqual({ role: "admin" });
  expect(await resolveScopeFromToken("mir_desconhecido")).toBeNull();
  expect(await resolveScopeFromToken(undefined)).toBeNull();
});

it("revogar invalida o token (resolve passa a null) e some do list ativo", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const { token, view } = await createMcpToken(u.id, "antigo");
  expect(await resolveScopeFromToken(token)).not.toBeNull();
  expect(await revokeMcpToken(u.id, view.id)).toEqual({ ok: true });
  expect(await resolveScopeFromToken(token)).toBeNull();
  const ativos = (await listMcpTokens(u.id)).filter((t) => t.revokedAt === null);
  expect(ativos).toHaveLength(0);
});

it("revogar token de OUTRO usuário não funciona (escopo)", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const { view } = await createMcpToken(a.id, "do A");
  expect(await revokeMcpToken(b.id, view.id)).toEqual({ ok: false });
  expect((await db.mcpToken.findUniqueOrThrow({ where: { id: view.id } })).revokedAt).toBeNull();
});

it("escopo client do token só enxerga/mexe nas metas do próprio dono", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const pa = await createProject({ userId: a.id, name: "A", owner: "oa", repo: "ra" });
  if (!pa.ok) throw new Error("setup");
  await metasCreate(asClient(a.id), {
    projectId: pa.project.id, title: "meta do A", dueDate: future().toISOString(),
  });
  // B (escopo do token de B) não resolve o projeto do A → erro
  await expect(metasList(asClient(b.id), { project: "oa/ra" })).rejects.toThrow();
  // A enxerga a sua
  expect((await metasList(asClient(a.id), { projectId: pa.project.id })).map((m) => m.title))
    .toEqual(["meta do A"]);
});
```

### E2E — `tests/e2e/mcp-token.spec.ts` (esqueleto; seletores finais na implementação)

Jornada: login (helper de sessão existente / seed) → `/dashboard/integracoes` → card "MCP / Claude
Code" → **Gerar token** → o texto puro aparece **uma vez** (`getByTestId("mcp-token-plaintext")`),
visível e copiável → o token entra na lista pelo `tokenPrefix` → **Revogar** → some da lista ativa.
Assert concreto: o `data-testid="mcp-token-plaintext"` contém `mir_` e, após revogar, a linha do
prefixo não aparece mais.

## Critérios de pronto

- [x] `tests/unit/mcp-tokens.test.ts` + `tests/integration/mcp-tokens.test.ts` verdes (vistos
      vermelhos antes via import inexistente + break-to-confirm no resolve por hash: os 2 casos
      client/revogado foram ao vermelho ao neutralizar a busca por hash, os de admin-env/isolamento
      seguiram verdes).
- [x] `tests/e2e/mcp-token.spec.ts` verde (gerar mostra 1×; revogar remove). `1 passed`.
- [x] Migração `20260621071629_mcp_tokens_per_user` aplicada; `prisma generate` ok; banco guarda
      **hash** (texto nunca persistido) e `tokenPrefix`.
- [x] `MCP_SERVICE_TOKEN` (env) ainda resolve admin; token revogado/desconhecido → recusa.
- [x] `bun run typecheck` limpo; `biome check` limpo nos arquivos da task (o `bun run lint`
      repo-wide acusa CRLF em arquivos **pré-existentes** não tocados — artefato de checkout
      `autocrlf` no Windows; o git guarda LF, então não é regressão desta task).
- [x] `DOC.md` atualizados: `src/lib/mcp/DOC.md`, `src/components/integracoes/DOC.md`,
      `src/app/dashboard/integracoes/DOC.md`, novos em `src/app/api/mcp-tokens/` (+ `[id]`) e
      `src/app/api/DOC.md`. `.docs/SPEC.md` (auth MCP + tabela `mcp_tokens` + linha de env) e
      `CLAUDE.md` §0 (MCP multi-usuário) ajustados; `.env.example` nota `MCP_SERVICE_TOKEN`
      opcional/local.
- [x] Spec marcada `done`.

## Divergências do plano

- **Removido `tests/unit/mcp-auth.test.ts`** (spec 013): testava `resolveScopeFromToken` como função
  **pura/síncrona** (admin-env, token errado, ausente). Com a 019 a função virou **assíncrona** e
  toca o Postgres (lookup por hash), então deixou de ser um unit. Os mesmos 3 casos passaram a ser
  cobertos — com `await` e infra real — pelo teste de integração
  `tests/integration/mcp-tokens.test.ts` ("MCP_SERVICE_TOKEN (env) ainda resolve admin; token
  desconhecido → null"). Sem perda de cobertura.

## Fora de escopo

- **MCP via HTTP** (`/api/mcp`) e o **comando de setup** copiável + status de conexão — são a **020**.
- Desligar `detectCurrentRepo()` no modo HTTP — **020** (não se aplica ao stdio).
- Expiração automática / rotação de tokens, escopos granulares por projeto — futuro, se pedido.
</content>
