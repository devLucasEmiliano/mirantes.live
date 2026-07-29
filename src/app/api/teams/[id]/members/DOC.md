# src/app/api/teams/[id]/members

## Propósito
Adiciona um membro à equipe (spec 022). `params` é **Promise**. **Admin-only**.

## Arquivos
- **`route.ts`**
  - `POST` — **ADMIN** (`401`/`403`) → zod `{ userId }` (`400`) → `addMember(id, userId)`.
    `team_not_found`/`user_not_found`/`already_member` → **`404`**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem lógica de negócio inline** — delega a `@/lib/teams`.
- Remoção de membro mora em `[userId]/route.ts` (`DELETE`), não aqui.
