# src/app/api/mcp-tokens/[id]

## Propósito
Revogação de um token MCP por `id` (spec 019). `params` é **Promise** neste Next (App Router) —
precisa de `await ctx.params`.

## Arquivos
- **`route.ts`**
  - `DELETE` — autenticado (`401`): `revokeMcpToken(current.id, id)` (soft-revoga **escopado ao
    dono**; token alheio/inexistente → `404 not_found`); sucesso → `{ ok: true }` `200`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem regra de negócio / escopo inline** — delega a `@/lib/mcp/tokens` (`revokeMcpToken`).
- Revogar token de **outro** usuário é impossível por contrato (filtro por `userId` no domínio).
