# src/app/api/goals/[id]/commit-link

## Propósito
Vínculo **idempotente meta↔commit** (spec 013): liga um commit já persistido à meta e aplica
o peso **uma única vez** (unique `commit_id+goal_id` anti double-count). Caminho manual/admin;
a atribuição automática mora no `attribution.ts` (gancho do sync). `params` é **Promise**.

## Arquivos
- **`route.ts`**
  - `POST` — **ADMIN** (`401`/`403`) → zod `{commitId}` (`400`) → `linkCommit(scope, {goalId:id, commitId})`.
    Meta/commit inexistente → **`404`**; senão `{ ok: true }` (re-`POST` não duplica nem reavança).

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem SQL inline** — só o service.
- **Sem cálculo de peso/percent aqui** — vem de `env` (pesos) + `derive.applyWeight` no service.
