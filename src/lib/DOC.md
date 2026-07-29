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
- `projects/` — seleção de projeto do header + `ref.ts` (match puro de referência humana → projeto, spec 015). Ver `projects/DOC.md`.
- `goals/` — Metas (spec 013): hierarquia, X→Y, derivação de pai e atribuição automática commit→meta **100% determinística** (keyword → branch → manual; LLM removido na spec 016). Único portão Postgres em `goals/service.ts`. **Leitura ganhou o escopo de equipe** (spec 022, `goalReadWhere`). Ver `goals/DOC.md`.
- `mcp/` — servidor **MCP** (stdio) de Metas (spec 013/015): expõe o service a ferramentas externas (Claude Code), operando no "projeto atual" (git remote) por ref/short code. Ver `mcp/DOC.md`.
- Arquivos diretos nesta pasta (abaixo), incluindo `teams.ts` (spec 022).

## Arquivos
- **`env.ts`** — valida `process.env` com zod (`DATABASE_URL`, `REDIS_URL`,
  `SESSION_SECRET` ≥32). OAuth do GitHub por usuário (spec 009): saiu o `GITHUB_PAT`
  global; entraram `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
  `GITHUB_TOKEN_ENC_KEY` (validada: precisa decodificar p/ **32 bytes** base64),
  `APP_BASE_URL` (url, monta o `redirect_uri` e os 303 de retorno) e
  `GITHUB_OAUTH_FAKE?` (opcional, "1" curto-circuita a rede no e2e). **Sync automático do
  GitHub (spec 016):** `GITHUB_SYNC_INTERVAL_MS` (coerce number, default 60000 — intervalo do
  worker; o piso de 15s mora em `github/worker.ts`) e `GITHUB_SYNC_AUTOSTART` (`"0"`/`"1"`,
  default `"1"`; `"0"` desliga o autostart via instrumentation no e2e/vitest/standalone). Exporta
  `env` já tipado; lança no boot se algo faltar. Importado por `db.ts`, `redis.ts`,
  `auth/cookie.ts`, `crypto/secret.ts`, `github/*` (oauth, oauth-state, client, worker) e
  `instrumentation.ts`.
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
  "último commit" saiu do dashboard). `findProjectByRef(scope, ref)` (spec 015) carrega
  `listProjects` e delega ao puro `matchProjectRef` (`projects/ref.ts`) p/ casar `owner/repo`|
  `repo`|`name` → projeto (usado pelo MCP "projeto atual"). `updateProject(id, scope, { name?,
  isPublic? }): Promise<UpdateProjectResult>` (spec 016 home pública): renomeia e/ou alterna a
  visibilidade pública de 1 projeto do ESCOPO via `updateMany { id, ...ownerWhere(scope) }` (atômico;
  0 linhas afetadas = `{ ok:false, error:"not_found" }`; admin alcança qualquer projeto, cliente só
  os seus). Em sucesso devolve `{ ok:true, project }`. O `Project` agora tem a coluna `isPublic`
  (default `false`). Retornos discriminados `ok`. Valida o
  slug (de `github/map`) antes de gravar; colisão `(userId,owner,repo)` (P2002) → `already_exists`
  (o mesmo repo coexiste p/ donos diferentes). Única porta ao Postgres no domínio de projetos.
- **`events.ts`** — leitura da **Timeline** unificada (spec 012). `listEvents(scope, {projectId?,
  cursor?, limit?})`: `where` por escopo (cliente → só `visibleToClient` E projeto próprio ou
  global; admin → tudo), filtro por `projectId`, `orderBy id desc`, cursor `id < cursor`; busca
  `limit+1` p/ derivar `nextCursor` → `{ events: TimelineEvent[]; nextCursor: string | null }`.
  `listPublicEvents(projectId, limit=7): Promise<TimelineEvent[]>` (spec 016 home pública): feed
  **público** scope-free de 1 projeto = `where { projectId, visibleToClient:true }`, `orderBy id desc`,
  `take limit`. `listShowcaseEvents(limit=7)`: feed **público** da home (sem `Scope`) — a semântica
  MUDOU (spec 016 home pública): a vitrine deixou de ser o "projeto mais antigo de um admin" e passou
  a ser o **projeto PÚBLICO mais antigo** (`where { isPublic:true }`, `orderBy createdAt asc`),
  delegando a `listPublicEvents`; sem projeto público → `[]`.
  `weeklyEventStats(scope, projectId?)`: contagens 7d (`commits`/`ci`/`total`) p/ o painel
  RESUMO DA SEMANA. DTO = `TimelineEvent` via `toDTO` (`id` `String()`, `createdAt` ISO).
  Depende de `@/lib/db` e do `Scope` de `projects.ts`. (A escrita/emissão de eventos mora em
  `events/` e em `github/sync.ts`.)
- **`teams.ts`** — serviço de **Equipes** (spec 022), único portão Postgres do domínio: grupo de
  usuários com leitura compartilhada das metas de um projeto, admin-only. `listTeams` (com
  membros/projetos resolvidos), `createTeam`, `deleteTeam` (delete físico — não é domínio
  auditável), `addMember`/`removeMember`, `assignProject`/`unassignProject` (`UPDATE
  project.teamId` — atribuir a uma 2ª equipe MOVE, cardinalidade 1 é garantida pela própria
  natureza do UPDATE), `listAssignableUsers`/`listAssignableProjects` (p/ os `<select>` do
  admin), `listTeamProjectIdsForUser`/`listTeamProjectsForUser` (usados por
  `goals/service.goalReadWhere` e por `goals/team-select.ts`).
- **`utils.ts`** — `cn()` (clsx + tailwind-merge). Helper de classe CSS.
- **`types.ts`** — tipos de domínio do front-end (Goal, TimelineEvent, Service…). `Goal` foi
  **estendido aditivamente** (spec 013) com campos opcionais das metas reais: `shortCode`,
  `projectId?`, `percent?`, `derived?`, `startValue?/targetValue?/currentValue?` (X→Y) e
  `attributedCommits?` — é o tipo devolvido por `goals/dto.ts` (`toGoalDTO`). `TimelineEvent` foi
  remodelado (spec 012): `id` `string` (bigint via `String()`), `createdAt` ISO.
- **`mock-data.ts`** — dados mock do front-end. `mockEvents` foi removido (spec 012). `mockGoals`/
  `mockSummary` **deixaram de ser consumidos pelo dashboard**: `/dashboard/metas` (spec 013) e a
  Visão Geral `/dashboard` (spec 014) leem metas/resumo reais via `goals/service` +
  `summarizeGoals`. A home pública `/` (spec 016 home pública) também passou a ler dados REAIS
  (metas/cards/timeline do projeto público selecionado via `listPublicGoals` /
  `publicWeeklyCommitStats` / `listPublicEvents` + `summarizeGoals`), de modo que `mockGoals`/
  `mockSummary` **não são mais consumidos por nenhuma página** — o último consumidor real do mock
  saiu. Seguem **definidos mas órfãos**, junto de `mockServices`, `mockIncidents`,
  `mockProjectUptimeDays` e demais, que ainda alimentam o `UptimePanel` (que segue mock).

## O que NÃO vai aqui
- **Sem componentes React / JSX** — esta pasta é lógica de servidor e tipos.
- **Sem `"use client"`** — `db.ts`/`redis.ts`/`auth/*` são exclusivamente servidor.
- Segredos só via `env.ts` (nunca hardcoded, log ou resposta ao cliente).
- Regras de negócio de metas/eventos/monitoramento entram em libs próprias nas suas specs,
  não aqui de forma genérica.
