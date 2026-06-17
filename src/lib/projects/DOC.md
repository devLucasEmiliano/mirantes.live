# src/lib/projects

## Propósito
Concerns da **seleção de projeto do header** (spec 012): a função pura que escolhe o projeto
do cookie, o helper de servidor que a resolve e a Server Action que persiste a escolha. É
distinta de `src/lib/projects.ts` (o **arquivo** irmão), que é o serviço CRUD/leituras de
Projetos — esta pasta cuida só de "qual projeto está em foco no header".

## Estrutura
Arquivos avulsos. `select.ts` tem a função pura (unit) + o resolvedor de servidor; `actions.ts`
é um arquivo `"use server"` dedicado (Server Action chamada pelo switcher client).

## Arquivos
- **`select.ts`**
  - `pickSelectedProject(projects, cookieVal)` — **puro/unit-testável**: devolve o projeto cujo
    `id` casa o cookie; cookie ausente/alheio/inexistente → **fallback = 1º da lista** (o mais
    antigo, já que `listProjects` vem `createdAt asc`); lista vazia → `null`. Genérico sobre
    `{ id: string }`. **Sem** imports de runtime (mantém o grafo do teste unit limpo).
  - `SELECTED_PROJECT_COOKIE` — constante `"selected_project_id"`.
  - `resolveSelectedProject(scope)` — helper de **Server Component**: lê o cookie
    (`next/headers`) + `listProjects(scope)` via **imports dinâmicos** (p/ não arrastar
    `next/headers`/Prisma ao grafo do teste da função pura) e aplica `pickSelectedProject`.
    Usado por `dashboard/page.tsx` e `dashboard/timeline/page.tsx` p/ filtrar o feed.
- **`actions.ts`** (`"use server"`) — `selectProject(projectId): Promise<void>`: resolve o
  usuário (`getCurrentUser`), **valida o pertencimento** via `getProject(projectId, scope)`
  (alheio/inexistente/sem sessão → no-op, não grava) e grava o cookie `selected_project_id`
  (`httpOnly`, `SameSite=Lax`, `path:/`, 1 ano). O switcher (client) o importa como referência
  RPC e chama `router.refresh()` em seguida. Depende de `next/headers`, `auth/session` e
  `../projects` (o arquivo).

## O que NÃO vai aqui
- **`pickSelectedProject` não pode ganhar imports de runtime** (`next/headers`, Prisma) — é a
  parte unit-testável; o acesso a cookie/banco fica em `resolveSelectedProject`/`actions.ts`.
- **`actions.ts` é exclusivamente `"use server"`** — não exportar dele utilitários puros (o
  client só deve importar a Server Action).
- **Sem CRUD de projeto** — criar/listar/remover e as leituras (commits da semana, último
  commit) seguem em `src/lib/projects.ts`.
- **Sem UI/JSX** — o dropdown é `components/layout/project-switcher.tsx`.
