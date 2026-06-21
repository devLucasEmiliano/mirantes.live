# src/app/api/projects/[id]

## Propósito
Item de **Projeto** por `id` (spec 008): leitura do log de atividade e remoção. `params` é
**Promise** neste Next (App Router) — precisa de `await ctx.params`.

## Estrutura
- `route.ts` — `GET`/`PATCH`/`DELETE`.
- `sync/` — `POST` de sincronização. Ver `sync/DOC.md`.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401`): **escopado** `getProject(id, scopeForUser(current))` → `404`
    se não existe **ou é de outro dono** (cliente em projeto alheio → 404); senão o projeto com
    `commits`/`branches`/`workflowRuns`. **`runId` (BigInt) serializado com `String()`** (não é
    JSON-safe).
  - `PATCH` — **qualquer logado** (spec 016, home pública): sessão (`401`) → valida o corpo
    com zod `{ name?: string(trim,1..120), isPublic?: boolean }` com `.refine` exigindo ao menos
    um campo (corpo vazio/inválido → `400 invalid_body`) → **escopado**
    `updateProject(id, scopeForUser(current), patch)` (renomeia e/ou alterna "Público"; alheio
    ou inexistente → `404 not_found`); sucesso → `{ project }` `200`.
  - `DELETE` — **qualquer logado** (spec 009; não é mais admin-only): sessão (`401`) →
    `deleteProject(id, scopeForUser(current))` (CASCADE nos filhos) → `404` se não existe **ou é
    alheio**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem regra de negócio / escopo inline** — delega a `@/lib/projects` (`scopeForUser`).
- **BigInt cru na resposta** — sempre `String(runId)`.
