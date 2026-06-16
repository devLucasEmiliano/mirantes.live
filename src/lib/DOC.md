# src/lib

## Propósito
Camada de infra e domínio compartilhada do servidor: validação de ambiente,
singletons de Postgres (Prisma) e Redis, snapshot público da home, utilitários de
UI e os tipos/mock do front-end. É onde mora o acesso a dados — nunca nos componentes.

## Estrutura
- `auth/` — autenticação (senha, cookie assinado, DAL de sessão, rate-limit). Ver `auth/DOC.md`.
- `account/` — serviços de conta (perfil, senha, avatar, iniciais), testáveis fora do Next. Ver `account/DOC.md`.
- Arquivos diretos nesta pasta (abaixo).

## Arquivos
- **`env.ts`** — valida `process.env` com zod (`DATABASE_URL`, `REDIS_URL`,
  `SESSION_SECRET` ≥32, `GITHUB_PAT?`). Exporta `env` já tipado; lança no boot se
  algo faltar. Importado por `db.ts`, `redis.ts` e `auth/cookie.ts`.
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
- **`utils.ts`** — `cn()` (clsx + tailwind-merge). Helper de classe CSS.
- **`types.ts`** — tipos de domínio do front-end (Goal, TimelineEvent, Service…). Mock/UI.
- **`mock-data.ts`** — dados mock do front-end (serão substituídos pela API real).

## O que NÃO vai aqui
- **Sem componentes React / JSX** — esta pasta é lógica de servidor e tipos.
- **Sem `"use client"`** — `db.ts`/`redis.ts`/`auth/*` são exclusivamente servidor.
- Segredos só via `env.ts` (nunca hardcoded, log ou resposta ao cliente).
- Regras de negócio de metas/eventos/monitoramento entram em libs próprias nas suas specs,
  não aqui de forma genérica.
