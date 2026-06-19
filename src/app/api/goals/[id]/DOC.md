# src/app/api/goals/[id]

## Propósito
Item de **Meta** por `id` (spec 013): edição e arquivamento. `params` é **Promise** neste
Next (App Router) — precisa de `await ctx.params`. Mutações **admin-only**.

## Estrutura
- `route.ts` — `PATCH`/`DELETE`.
- `branch-link/` — vínculo meta↔branch (`POST`/`DELETE`). Ver `branch-link/DOC.md`.
- `commit-link/` — vínculo idempotente meta↔commit (`POST`). Ver `commit-link/DOC.md`.

## Arquivos
- **`route.ts`**
  - `PATCH` — **ADMIN** (`401`/`403`) → zod parcial
    `{title?,description?,status?,progress?,dueDate?,startValue?,targetValue?,currentValue?}`
    (`400`) → `updateGoal(scope, id, …)`. Pai com filhos editando progress/status → **`409`
    has_children**; alheia/inexistente → **`404`**; senão `{ goal }`. status→`done` carimba
    `completedAt`; sair de `done` limpa.
  - `DELETE` — **ADMIN** (`401`/`403`) → `archiveGoal` (soft delete em **cascata** na subárvore);
    alheia/inexistente → **`404`**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem regra de negócio inline** — delega a `@/lib/goals/service`.
- **Sem `progress`/`status` em pai** — é derivado (read-only); o service recusa (`has_children`).
