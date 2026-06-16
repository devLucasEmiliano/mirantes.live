# src/app/api/projects/[id]/sync

## Propósito
Dispara a sincronização de 1 projeto sob demanda (spec 008) — o MESMO núcleo `syncProject`
que o worker de polling usa. `params` é **Promise** (await `ctx.params`).

## Arquivos
- **`route.ts`** — `POST` (**admin**): sessão (`401`) → não-admin (`403`) → `syncProject(id)`
  (sem client → resolve o PAT do ambiente). Mapa de erro → HTTP: `no_token` → **`409`**,
  `project_not_found` → **`404`**, `github_error` → **`502`**; sucesso → **`200`** com
  `{ inserted, lastSeenSha }`.

## O que NÃO vai aqui
- **Sem UI/JSX**; **sem o PAT na resposta/log** (fica em `@/lib/github/client`).
- **Sem o algoritmo de sync inline** — é `@/lib/github/sync` (testado).
