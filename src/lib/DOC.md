# src/lib

## Propósito
Camada de infra e domínio compartilhada do servidor: validação de ambiente,
singletons de Postgres (Prisma) e Redis, snapshot público da home, utilitários de
UI e os tipos/mock do front-end. É onde mora o acesso a dados — nunca nos componentes.

## Estrutura
- `auth/` — autenticação (senha, cookie assinado, DAL de sessão, rate-limit). Ver `auth/DOC.md`.
- `account/` — serviços de conta (perfil, senha, avatar, iniciais), testáveis fora do Next. Ver `account/DOC.md`.
- `crypto/` — cifra simétrica em repouso (AES-256-GCM) do token OAuth do GitHub. Ver `crypto/DOC.md`.
- `github/` — integração GitHub (OAuth por usuário, client HTTP, mapeadores puros, sync idempotente, worker). Ver `github/DOC.md`.
- `events/` — eventos da Timeline (mapeadores puros commit/run, formatação de datas, backfill). Ver `events/DOC.md`.
- `projects/` — seleção de projeto do header (função pura + resolvedor de cookie + Server Action). Ver `projects/DOC.md`.
- Arquivos diretos nesta pasta (abaixo).

## Arquivos
- **`env.ts`** — valida `process.env` com zod (`DATABASE_URL`, `REDIS_URL`,
  `SESSION_SECRET` ≥32). OAuth do GitHub por usuário (spec 009): saiu o `GITHUB_PAT`
  global; entraram `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
  `GITHUB_TOKEN_ENC_KEY` (validada: precisa decodificar p/ **32 bytes** base64),
  `APP_BASE_URL` (url, monta o `redirect_uri` e os 303 de retorno) e
  `GITHUB_OAUTH_FAKE?` (opcional, "1" curto-circuita a rede no e2e). Exporta `env` já
  tipado; lança no boot se algo faltar. Importado por `db.ts`, `redis.ts`,
  `auth/cookie.ts`, `crypto/secret.ts` e `github/*` (oauth, oauth-state, client).
- **`db.ts`** — singleton do **Prisma Client** (padrão `globalThis` p/ hot-reload).
  No Prisma 7 o client exige driver adapter: usa `@prisma/adapter-pg` com
  `env.DATABASE_URL`. O pool `pg` é configurado com `keepAlive`, `idleTimeoutMillis`
  e `connectionTimeoutMillis` p/ detectar/reciclar sockets ociosos derrubados pela
  LAN (evita "Operation has timed out"). Exporta `db`. Única porta de entrada ao Postgres no app.
- **`redis.ts`** — singleton **ioredis** (`lazyConnect`, erro logado e não-fatal).
  Exporta `redis`. Usado por cache (home snapshot) e rate-limit. Pub/Sub fica p/ a spec de SSE.
- **`home-snapshot.ts`** — `buildHomeSnapshot()`, `writeHomeSnapshot()` (→ Redis
  `home:snapshot`) e `readHomeSnapshot()` (← Redis, com fallback estático). Conteúdo
  público e não sensível (nome, tagline, flag "no ar", timestamp).
- **`projects.ts`** — serviço de Projetos (specs 008 + 009), **escopado por papel**: novo
  tipo `Scope = { role:"admin" } | { role:"client"; userId }` + helper `scopeForUser(user)`
  (admin = global; client = só os seus). `createProject` carimba o `userId` do dono;
  `listProjects`/`getProject`/`deleteProject`/`weeklyCommitStats`/`latestCommit` recebem o
  `Scope` e filtram por dono (admin sem filtro). `weeklyCommitStats`/`latestCommit` ganharam
  um `projectId?` opcional (spec 012) p/ estreitar ao **projeto selecionado** no header;
  `latestCommit` segue exportado (testes/back-compat), mas **não é mais renderizado** (o card
  "último commit" saiu do dashboard). Retornos discriminados `ok`. Valida o slug (de
  `github/map`) antes de gravar; colisão `(userId,owner,repo)` (P2002) → `already_exists` (o
  mesmo repo coexiste p/ donos diferentes). Única porta ao Postgres no domínio de projetos.
- **`events.ts`** — leitura da **Timeline** unificada (spec 012). `listEvents(scope, {projectId?,
  cursor?, limit?})`: `where` por escopo (cliente → só `visibleToClient` E projeto próprio ou
  global; admin → tudo), filtro por `projectId`, `orderBy id desc`, cursor `id < cursor`; busca
  `limit+1` p/ derivar `nextCursor` → `{ events: TimelineEvent[]; nextCursor: string | null }`.
  `listShowcaseEvents(limit=7)`: feed **público** da home (sem `Scope`) = eventos
  `visibleToClient:true` do **projeto mais antigo de um admin** (vitrine); sem projeto → `[]`.
  `weeklyEventStats(scope, projectId?)`: contagens 7d (`commits`/`ci`/`total`) p/ o painel
  RESUMO DA SEMANA. DTO = `TimelineEvent` via `toDTO` (`id` `String()`, `createdAt` ISO).
  Depende de `@/lib/db` e do `Scope` de `projects.ts`. (A escrita/emissão de eventos mora em
  `events/` e em `github/sync.ts`.)
- **`utils.ts`** — `cn()` (clsx + tailwind-merge). Helper de classe CSS.
- **`types.ts`** — tipos de domínio do front-end (Goal, TimelineEvent, Service…). Mock/UI.
  `TimelineEvent` foi remodelado (spec 012) p/ casar a linha real de `events`: `id` agora é
  **`string`** (bigint serializado com `String()`) e `createdAt` **ISO** substitui o antigo
  `timestamp`; os componentes formatam via `events/format.ts`.
- **`mock-data.ts`** — dados mock do front-end (serão substituídos pela API real). `mockEvents`
  foi **removido** (spec 012 — a Timeline e a Atividade Recente, no dashboard e na home, leem
  `events` reais; sem consumidor de mock). `mockProject` já saíra (spec 008). Seguem mock:
  `mockGoals`, `mockSummary`, `mockServices`, `mockIncidents`, `mockProjectUptimeDays` e demais.

## O que NÃO vai aqui
- **Sem componentes React / JSX** — esta pasta é lógica de servidor e tipos.
- **Sem `"use client"`** — `db.ts`/`redis.ts`/`auth/*` são exclusivamente servidor.
- Segredos só via `env.ts` (nunca hardcoded, log ou resposta ao cliente).
- Regras de negócio de metas/eventos/monitoramento entram em libs próprias nas suas specs,
  não aqui de forma genérica.
