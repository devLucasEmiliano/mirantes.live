# src/app/api/teams/[id]/members/[userId]

## Propósito
Remove um membro da equipe (spec 022) — revoga a leitura compartilhada das metas dos projetos
atribuídos a ela. `params` é **Promise**. **Admin-only**.

## Arquivos
- **`route.ts`**
  - `DELETE` — **ADMIN** (`401`/`403`) → `removeMember(id, userId)`; vínculo inexistente →
    **`404`**; senão `{ ok: true }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem lógica de negócio inline** — delega a `@/lib/teams`.
