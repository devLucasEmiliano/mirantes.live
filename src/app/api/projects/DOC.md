# src/app/api/projects

## Propósito
Route Handlers do recurso **Projetos** (spec 008): listar/criar projetos e (em subrotas)
ler/remover/sincronizar um projeto. Handlers finos — autorizam e delegam a `@/lib/projects`
e `@/lib/github/sync`.

## Estrutura
- `route.ts` — coleção (`GET`/`POST`).
- `[id]/` — item (`GET`/`DELETE`). Ver `[id]/DOC.md`.
- `[id]/sync/` — disparo do sync (`POST`). Ver `[id]/sync/DOC.md`.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401` sem sessão) → **escopado** `listProjects(scopeForUser(current))`
    (cliente só os seus; admin todos) → `{ projects }`.
  - `POST` — **qualquer logado** (spec 009; não é mais admin-only): sessão (`401`) → zod
    `{name?,owner,repo}` (`400`) → `createProject` carimbando o dono (`userId = current.id`).
    `invalid_slug` → **`400`**; `already_exists` → **`409`**; criado → **`201`**.
    Nome é opcional; sem ele usa o `repo` (o slug owner/repo aparece à parte na UI).

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas `Request → Response`.
- **Sem lógica de negócio inline** — mora em `@/lib/projects` (CRUD/escopo) e `@/lib/github/*` (sync).
- **Sem segredo na resposta** (token nunca sai do servidor); toda mutação valida (zod) e
  escopa por dono via `scopeForUser` (SPEC §11).
