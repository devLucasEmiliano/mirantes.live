# src

## Propósito
Raiz do app Next.js (App Router). Reúne a árvore de UI/Route Handlers (`app/`), os
componentes compartilhados (`components/`), a camada de infra/domínio do servidor
(`lib/`) e os dois arquivos de convenção do Next que ficam **na raiz do `src/`**:
o proxy (ex-middleware) e a instrumentação de boot.

## Estrutura
- `app/` — App Router: páginas, layouts e Route Handlers. Ver `app/DOC.md`.
- `components/` — componentes React compartilhados (UI + shared). Ver `components/DOC.md`.
- `lib/` — infra e domínio do servidor (env, db, redis, auth, github, goals, mcp…). Ver `lib/DOC.md`.
- Arquivos diretos nesta pasta (abaixo).

## Arquivos
- **`proxy.ts`** — Next 16: ex-`middleware.ts` (runtime Node por padrão). Gate **otimista** das
  rotas `/dashboard*`: verifica só a **assinatura** do cookie de sessão (sem tocar no banco),
  redireciona p/ `/login` se inválida e faz o **sliding** do cookie quando válida. A verificação
  real (linha de sessão, expiração, papel) fica no DAL e nos Route Handlers (SPEC §3). Exporta
  `proxy` + `config.matcher`. Depende de `@/lib/auth/cookie`.
- **`instrumentation.ts`** — convenção do Next: `register()` roda **1× por instância** no boot e
  **bloqueia** até resolver. Liga o **worker de sync do GitHub no mesmo container** (spec 016):
  sai cedo se `process.env.NEXT_RUNTIME !== "nodejs"` (não carrega Prisma/sockets no Edge), faz
  `import()` **dinâmico** de `@/lib/env` e `@/lib/github/worker`, e — se
  `shouldAutostart(runtime, env.GITHUB_SYNC_AUTOSTART)` — chama `startGitHubSyncLoopOnce()`
  (**fire-and-forget**: nunca `await` no loop infinito, senão o boot trava). Depende, sob demanda,
  de `@/lib/env` e `@/lib/github/worker`.

## O que NÃO vai aqui
- **Sem componentes/JSX nesta raiz** — UI mora em `app/` e `components/`.
- **Sem lógica de negócio nos arquivos de convenção** — `proxy.ts`/`instrumentation.ts` só fazem
  o *glue* fino de boot/edge; a regra (sync, sessão) vive em `lib/`.
- **`instrumentation.ts` não dá `await` no loop** nem carrega Prisma no Edge — guardar por
  `NEXT_RUNTIME` e usar `import()` dinâmico (a contradição quebraria o boot ou o bundle Edge).
