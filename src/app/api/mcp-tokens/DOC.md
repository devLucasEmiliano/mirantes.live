# src/app/api/mcp-tokens

## Propósito
Tokens pessoais do MCP (spec 019): cada usuário gera/lista/revoga os **seus** tokens, que o servidor
MCP de Metas resolve para `{ role: "client", userId }`. Handlers finos — toda a lógica (gerar, hash,
persistir, projetar sem hash, revogar escopado) vive em `@/lib/mcp/tokens`.

## Estrutura
- `route.ts` — `GET` (listar) e `POST` (criar).
- `[id]/` — `DELETE` (revogar). Ver `[id]/DOC.md`.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401`): `listMcpTokens(current.id)` → `{ tokens }` `200`. A projeção
    `McpTokenView` **nunca** inclui `tokenHash`.
  - `POST` — autenticado (`401`): valida `{ name: string(trim,1..60) }` com zod (`400 invalid_body`)
    → `createMcpToken(current.id, name)` → `{ token, view }` `201`. **O texto puro do token vai na
    resposta UMA vez** e depois só vive o hash no banco.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas handlers `Request → Response`.
- **Sem acesso a Prisma direto / regra de negócio** — delega a `@/lib/mcp/tokens`.
- **Sem escopo por papel** — tokens são sempre do `current.id` (não há visão admin de tokens alheios).
- **Nunca devolver `tokenHash`** ao cliente; o texto puro só na criação.
