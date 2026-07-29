# src/app/api/teams/[id]

## Propósito
Item de **Equipe** por `id` (spec 022): remoção. `params` é **Promise** neste Next (App
Router) — precisa de `await ctx.params`. **Admin-only**.

## Estrutura
- `route.ts` — `DELETE`.
- `members/` — adicionar/remover membro (`POST`/`[userId]/DELETE`). Ver `members/DOC.md`.
- `projects/` — atribuir/desatribuir projeto (`POST`/`[projectId]/DELETE`). Ver `projects/DOC.md`.

## Arquivos
- **`route.ts`**
  - `DELETE` — **ADMIN** (`401`/`403`) → `deleteTeam(id)` (delete físico; cascade em
    `team_members`, `projects.teamId` some via `onDelete:SetNull`); inexistente → **`404`**;
    senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem lógica de negócio inline** — delega a `@/lib/teams`.
- **Sem soft delete** — equipe não é domínio auditável como metas (decisão da spec 022).
