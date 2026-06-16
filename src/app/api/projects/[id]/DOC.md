# src/app/api/projects/[id]

## Propósito
Item de **Projeto** por `id` (spec 008): leitura do log de atividade e remoção. `params` é
**Promise** neste Next (App Router) — precisa de `await ctx.params`.

## Estrutura
- `route.ts` — `GET`/`DELETE`.
- `sync/` — `POST` de sincronização. Ver `sync/DOC.md`.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401`): `getProject(id)` → `404` se não existe; senão o projeto com
    `commits`/`branches`/`workflowRuns`. **`runId` (BigInt) serializado com `String()`** (não é
    JSON-safe).
  - `DELETE` — **admin**: sessão (`401`) → não-admin (`403`) → `deleteProject(id)` (CASCADE nos
    filhos) → `404` se não existe; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem regra de negócio** — delega a `@/lib/projects`.
- **BigInt cru na resposta** — sempre `String(runId)`.
