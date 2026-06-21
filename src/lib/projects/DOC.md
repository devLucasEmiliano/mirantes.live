# src/lib/projects

## Propósito
Concerns da **seleção de projeto do header** (spec 012): a função pura que escolhe o projeto
do cookie, o helper de servidor que a resolve e a Server Action que persiste a escolha. É
distinta de `src/lib/projects.ts` (o **arquivo** irmão), que é o serviço CRUD/leituras de
Projetos — esta pasta cuida só de "qual projeto está em foco no header". A spec 016 acrescenta
o **espelho público** desses concerns (`public.ts`, `public-select.ts`, `public-actions.ts`)
para a home pública `/` real, **scope-free** (a visibilidade `isPublic` É a autorização).

## Estrutura
Arquivos avulsos. `select.ts` tem a função pura (unit) + o resolvedor de servidor; `ref.ts` é a
função pura que casa uma referência humana → projeto; `actions.ts` é um arquivo `"use server"`
dedicado (Server Action chamada pelo switcher client). O trio `public-*` espelha esse desenho
para a home `/`: `public.ts` (leituras públicas sem `Scope`), `public-select.ts` (função pura +
resolvedor de servidor) e `public-actions.ts` (Server Action chamada pelo switcher público).

## Arquivos
- **`ref.ts`** (spec 015) — `matchProjectRef(projects, ref)` **puro/unit-testável**: casa uma
  referência humana por PRECEDÊNCIA (case-insensitive + trim) `owner/repo` → `repo` → `name`. No 1º
  nível com match: 1 → `{ ok, project }`; >1 → `{ ok:false, error:"ambiguous", matches }`; nenhum em
  nível algum → `{ ok:false, error:"not_found" }`. Genérico sobre `ProjectRefLike` ({name,owner,repo}).
  Sem I/O — a versão que carrega os projetos do escopo é `findProjectByRef` em `../projects.ts`.
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
- **`public.ts`** (spec 016) — camada **PÚBLICA** de projetos, **scope-free** (sem `Scope`; a
  visibilidade `isPublic` **É** a autorização). É o caminho de leitura da home `/` anônima.
  - `listPublicProjects(): Promise<Project[]>` — `where { isPublic:true }`, `orderBy createdAt asc`
    (mais antigo primeiro).
  - `getPublicProject(id): Promise<Project | null>` — `findFirst { id, isPublic:true }`; projeto
    privado/inexistente → `null` (**limite de segurança**: privado nunca é servido).
  - `publicWeeklyCommitStats(projectId): Promise<{ count; previousCount }>` — espelha
    `weeklyCommitStats` mas fixo em 1 projeto e **sem `Scope`**: janela atual ≤7d e anterior 7–14d.
    Único portão Postgres do caminho da home `/` anônima.
- **`public-select.ts`** (spec 016) — seleção do projeto público da home `/` (espelha `select.ts`).
  - `PUBLIC_PROJECT_COOKIE` — constante `"public_project_id"` (cookie de **MEMÓRIA**; o link
    `?projeto=` tem prioridade).
  - `interface PublicProjectLike { id; name; owner; repo }`.
  - `publicSlug(p)` — **puro**: `owner/repo` (vai na URL `?projeto=`).
  - `pickPublicProject<T extends PublicProjectLike>(projects, urlRef, cookieId): T | null` —
    **puro/unit-testável**: precedência URL (match **ÚNICO** via `matchProjectRef` de `./ref`) >
    cookie (id na lista) > mais antigo (1º) > `null`. URL ambígua/inexistente cai pro cookie;
    cookie inválido cai pro mais antigo. **Sem** imports de runtime.
  - `resolvePublicSelection(urlRef): Promise<Project | null>` — helper de **Server Component**:
    imports **dinâmicos** de `next/headers` e `./public`; lê o cookie + `listPublicProjects()` +
    aplica `pickPublicProject`.
- **`public-actions.ts`** (`"use server"`, spec 016) — `selectPublicProject(projectId): Promise<void>`:
  **valida o limite** via `getPublicProject` (privado/inexistente → no-op); senão grava o cookie
  `public_project_id` (`SameSite=Lax`, `path:/`, 1 ano). A escrita do cookie é **best-effort**
  (try/catch): sem request scope, degrada em silêncio (o cookie é só memória; o `?projeto=` é o
  mecanismo compartilhável). Chamado pelo `PublicProjectSwitcher` (client).

## O que NÃO vai aqui
- **`pickSelectedProject` não pode ganhar imports de runtime** (`next/headers`, Prisma) — é a
  parte unit-testável; o acesso a cookie/banco fica em `resolveSelectedProject`/`actions.ts`.
- **`actions.ts` é exclusivamente `"use server"`** — não exportar dele utilitários puros (o
  client só deve importar a Server Action).
- **Sem CRUD de projeto** — criar/listar/remover, `updateProject` (rename + toggle público) e as
  leituras escopadas (commits da semana, último commit) seguem em `src/lib/projects.ts` (o
  arquivo), não aqui.
- **A camada pública é scope-free POR DESIGN** — `public.ts`/`public-select.ts`/`public-actions.ts`
  **não** recebem `Scope`: a visibilidade pública (`isPublic`) é a autorização. Isso é distinto da
  seleção **escopada** do header (`select.ts`/`actions.ts`, que validam pertencimento por `Scope`);
  não misturar os dois caminhos.
- **`pickPublicProject` não pode ganhar imports de runtime** (`next/headers`, Prisma) — espelha a
  regra de `pickSelectedProject`; cookie/banco ficam em `resolvePublicSelection`/`public-actions.ts`.
- **`public-actions.ts` é exclusivamente `"use server"`** — não exportar dele utilitários puros (o
  client só deve importar a Server Action).
- **Sem UI/JSX** — o dropdown escopado é `components/layout/project-switcher.tsx`; o público é o
  `PublicProjectSwitcher`.
