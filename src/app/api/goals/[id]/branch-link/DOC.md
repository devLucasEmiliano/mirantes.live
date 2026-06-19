# src/app/api/goals/[id]/branch-link

## Propósito
Vínculo **meta↔branch** (spec 013): base da atribuição determinística — um commit na branch
vinculada (ou um merge que cite o nome dela) avança a meta quando o LLM está offline.
Mutações **admin-only**. `params` é **Promise**.

## Arquivos
- **`route.ts`**
  - `POST` — **ADMIN** (`401`/`403`) → zod `{branchName}` (`400`) → `linkBranch(scope, id, branchName)`
    (upsert por `(projectId, branchName)`); meta alheia/sem projeto → **`404`**; senão `{ ok: true }`.
  - `DELETE` — **ADMIN** → zod `{branchName}` → `unlinkBranch`; → `{ ok: true }` (idempotente).

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem SQL inline** — só o service (`@/lib/goals/service`).
- A regra de match (keyword > branch > manual) mora no `resolver.ts` puro, não aqui.
