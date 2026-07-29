# src/app/api/teams

## Propósito
Route Handlers do recurso **Equipes** (spec 022): acesso compartilhado (leitura) às metas de um
projeto. Gestão **admin-only** — cliente nunca chama estas rotas. Handlers finos — autorizam e
delegam a `@/lib/teams`.

## Estrutura
- `route.ts` — coleção (`GET`/`POST`).
- `[id]/` — item (`DELETE`) + subrotas `members/` e `projects/`. Ver os DOC.md.

## Arquivos
- **`route.ts`**
  - `GET` — **ADMIN** (`401`/`403`): `listTeams()` → `{ teams }` (cada equipe com `members` e
    `projects` já resolvidos).
  - `POST` — **ADMIN**: zod `{ name }` (`400`) → `createTeam(name)` → **`201`** `{ team }`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas `Request → Response`.
- **Sem lógica de negócio inline** — tudo delega a `@/lib/teams` (único portão Postgres).
- **Sem acesso de `role=client`** — nenhuma rota aqui é alcançável por cliente (403).
