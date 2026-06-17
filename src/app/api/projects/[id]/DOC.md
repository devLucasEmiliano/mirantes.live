# src/app/api/projects/[id]

## Propósito
Item de **Projeto** por `id` (spec 008): leitura do log de atividade e remoção. `params` é
**Promise** neste Next (App Router) — precisa de `await ctx.params`.

## Estrutura
- `route.ts` — `GET`/`DELETE`.
- `sync/` — `POST` de sincronização. Ver `sync/DOC.md`.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401`): **escopado** `getProject(id, scopeForUser(current))` → `404`
    se não existe **ou é de outro dono** (cliente em projeto alheio → 404); senão o projeto com
    `commits`/`branches`/`workflowRuns`. **`runId` (BigInt) serializado com `String()`** (não é
    JSON-safe).
  - `DELETE` — **qualquer logado** (spec 009; não é mais admin-only): sessão (`401`) →
    `deleteProject(id, scopeForUser(current))` (CASCADE nos filhos) → `404` se não existe **ou é
    alheio**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem regra de negócio / escopo inline** — delega a `@/lib/projects` (`scopeForUser`).
- **BigInt cru na resposta** — sempre `String(runId)`.
