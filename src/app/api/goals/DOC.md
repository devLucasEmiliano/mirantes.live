# src/app/api/goals

## Propósito
Route Handlers do recurso **Metas** (spec 013): listar a árvore derivada e criar metas
(X→Y medível ou manual). Handlers finos — autorizam e delegam a `@/lib/goals/service`;
a serialização JSON-safe vem de `@/lib/goals/dto`.

## Estrutura
- `route.ts` — coleção (`GET`/`POST`).
- `[id]/` — item (`PATCH`/`DELETE`) + subrotas `branch-link/` e `commit-link/`. Ver os DOC.md.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401` sem sessão) → **escopado** `listGoals(scopeForUser(current), ?projectId)`
    (cliente só metas de projeto próprio; admin tudo) → `{ goals }` (árvore derivada via `toGoalDTO`,
    `dueDate` `AAAA-MM-DD`).
  - `POST` — **ADMIN** (`403` p/ cliente): sessão (`401`) → zod
    `{projectId?,title,dueDate,parentId?,description?,status?,startValue?,targetValue?,currentValue?}`
    (`400`) → `createGoal`. `not_found` (projeto fora do escopo) → **`404`**; `invalid_parent` →
    **`400`**; criado → **`201`** `{ goal }`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas `Request → Response`.
- **Sem lógica de negócio inline** — CRUD/escopo/derivação moram em `@/lib/goals/*`.
- **Sem acesso direto ao Prisma** — só via o service (único portão Postgres das metas).
- Mutações são **admin-only** (papel checado no handler); leitura é escopada por `scopeForUser`.
