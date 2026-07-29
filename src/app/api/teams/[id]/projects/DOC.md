# src/app/api/teams/[id]/projects

## Propósito
Atribui um projeto à equipe (spec 022) — 1 projeto pertence a **no máx. 1 equipe**; atribuir a
uma 2ª equipe **move** (não duplica leitura). `params` é **Promise**. **Admin-only**.

## Arquivos
- **`route.ts`**
  - `POST` — **ADMIN** (`401`/`403`) → zod `{ projectId }` (`400`) →
    `assignProject(id, projectId)` (`UPDATE project.teamId`, atômico). `team_not_found`/
    `project_not_found` → **`404`**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem lógica de negócio inline** — delega a `@/lib/teams`.
- Desatribuição mora em `[projectId]/route.ts` (`DELETE`), não aqui.
