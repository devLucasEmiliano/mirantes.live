# src/app/api/projects/[id]/sync

## Propósito
Dispara a sincronização de 1 projeto sob demanda (spec 008) — o MESMO núcleo `syncProject`
que o worker de polling usa. `params` é **Promise** (await `ctx.params`).

## Arquivos
- **`route.ts`** — `POST` (**qualquer logado**; spec 009, não é mais admin-only): sessão (`401`)
  → **ownership** `getProject(id, scopeForUser(current))` (cliente só os seus; alheio/inexistente
  → **`404`**) → `syncProject(id)`. O sync usa o **token do DONO** do projeto. Mapa de erro →
  HTTP: `not_connected` → **`409`**, `project_not_found` → **`404`**, `github_error` → **`502`**;
  sucesso → **`200`** com `{ inserted, lastSeenSha }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem o token na resposta/log** (fica em `@/lib/github/*`).
- **Sem o algoritmo de sync inline** — é `@/lib/github/sync` (testado).
