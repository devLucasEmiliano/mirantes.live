# src/app/api/teams/[id]/projects/[projectId]

## Propósito
Desatribui um projeto da equipe (spec 022) — revoga a leitura compartilhada das metas desse
projeto p/ todos os membros. `params` é **Promise**. **Admin-only**.

## Arquivos
- **`route.ts`**
  - `DELETE` — **ADMIN** (`401`/`403`) → `unassignProject(id, projectId)` (só limpa se o
    projeto pertence de fato a ESTA equipe); senão **`404`**; sucesso → `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem lógica de negócio inline** — delega a `@/lib/teams`.
