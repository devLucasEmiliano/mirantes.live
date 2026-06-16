---
id: 003
title: Autenticação (login/logout/rate-limit/troca de senha) + Seed + Home no Redis
status: done
test_levels: []   # ⚠️ Decisão explícita do humano neste chat: SEM testes nesta task.
                  # Desvia do CLAUDE.md §3/§5 (passo vermelho/TDD). Verificação manual (dev + Playwright MCP).
created: 2026-06-15
---

# 003 — Autenticação + Seed

## Objetivo

Ligar o SPEC §2–§3 à realidade. O front-end hoje é **100% mock**
(`src/components/login/login-form.tsx` só faz `router.push("/dashboard")`; sem
`proxy`/middleware, sem cliente de DB/Redis, sem tabelas `users`/`sessions`).
Esta task entrega:

- Autenticação real por **sessão** (cookie httpOnly assinado + argon2id, sliding 7d).
- Proteção de rotas: **só `/` é pública**; todo `/dashboard/**` exige sessão; papel `admin`/`client`.
- **Seed** que provisiona os 2 usuários (não há cadastro público — PRD §2).
- Home `/` servida de um **snapshot público no Redis** (SPEC §1 "cache opcional"; Postgres = fonte de verdade).

Escopo fechado: **auth + seed**. Nenhuma outra feature.

## Decisões aprovadas pelo humano (registro CLAUDE.md §0/§1)

1. **Acesso ao banco: Prisma** — nova dependência aprovada (fora da stack travada do §0).
2. **Escopo de auth: completo** — login, logout, rate-limit no login, troca de senha + proteção por sessão e papel.
3. **Home `/` no Redis: snapshot público estático** (nome do projeto, tagline, flag "no ar", timestamp). Estende SPEC §1/§4 → **atualizar SPEC.md** nesta task.
4. **Seed: só usuários admin + client.**
5. **Credenciais: fixas de dev no código**, impressas pelo seed (apenas dev).
6. **Testes: NENHUM** ("Nada"). Desvio explícito do §3/§5 — `test_levels: []`. Verificação manual.
7. **Banco pode ser resetado** (`prisma migrate reset`).

## Dependências a adicionar (aprovadas)

- `dependencies`: `@prisma/client`, `@node-rs/argon2` (argon2id, binário pré-compilado p/ Windows), `ioredis`, `zod`.
- `devDependencies`: `prisma`, `tsx`.
- `next.config.ts`: `serverExternalPackages: ['@prisma/client', '@node-rs/argon2', 'ioredis']`.

> **Divergência registrada (Prisma 7) — aprovada no chat.** O npm instalou **Prisma 7**
> (`@prisma/client@^7.8.0`), que **exige driver adapter** (`new PrismaClient()` sem adapter
> lança erro). Decisão do humano neste chat: adicionar **`@prisma/adapter-pg`** (dependency;
> traz `pg` transitivamente — não importado diretamente). O Prisma 7 também **não** aceita
> mais `datasource.url` no schema nem a chave `prisma` do `package.json`, e **não auto-carrega
> `.env`**: a URL de migração e o comando de seed foram para **`prisma.config.ts`**, que
> carrega o `.env` via **`dotenv`** (devDependency). Deps finais — prod: `@prisma/client`,
> `@prisma/adapter-pg`, `@node-rs/argon2`, `ioredis`, `zod`; dev: `prisma`, `tsx`, `dotenv`.

> Nota Next 16 (AGENTS.md): `middleware.ts` foi renomeado para **`proxy.ts`** (runtime Node por padrão, sem opção `runtime`); `cookies()`/`headers()` são **async**; `params` de rota dinâmica é **Promise**; cookies só podem ser **setados** em Route Handler / proxy / Server Action (nunca em Server Component). Confirmado em `node_modules/next/dist/docs/`.

## Mudanças de schema (Prisma — só as 2 tabelas necessárias agora)

`prisma/schema.prisma` — fiel ao SPEC §2.1–2.2 (`role` como `String` text):

```prisma
model User {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique
  passwordHash String    @map("password_hash")
  role         String    // 'admin' | 'client'
  createdAt    DateTime  @default(now()) @map("created_at")
  sessions     Session[]
  @@map("users")
}
model Session {
  id        String   @id @default(uuid()) @db.Uuid  // token no cookie httpOnly
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime @map("expires_at")  // sliding 7d
  createdAt DateTime @default(now()) @map("created_at")
  @@map("sessions")
}
```

Migration `init_auth` via `prisma migrate dev`. Demais tabelas do SPEC ficam para specs próprias.

> No Prisma 7 a conexão da CLI mora em `prisma.config.ts` (`datasource.url` + `migrations.seed`),
> não no bloco `datasource` do schema (que fica só com `provider`).

## Arquivos a criar / alterar

**Infra / lib (criar)**
- `src/lib/env.ts` — validação zod de `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET` (min 32), `GITHUB_PAT?` (SPEC §11).
- `src/lib/db.ts` — singleton Prisma (padrão `globalThis` p/ hot-reload).
- `src/lib/redis.ts` — singleton `ioredis` (cache + rate-limit; pub/sub fica p/ spec de SSE).
- `src/lib/home-snapshot.ts` — `buildHomeSnapshot()` / `writeHomeSnapshot()` (→ Redis `home:snapshot`) / `readHomeSnapshot()` (← Redis, com default).

**Auth lib (criar) — `src/lib/auth/`**
- `password.ts` — `hashPassword` / `verifyPassword` (argon2id).
- `cookie.ts` — **puro** (sem `next/headers`, p/ rodar também no `proxy.ts`): assina/verifica cookie via HMAC-SHA256 (`SESSION_SECRET`), nome do cookie, max-age, `buildSessionCookieOptions()` (Secure só em produção, p/ permitir http local em dev). *Divergência:* o **set/clear via `cookies()` ficou em `session.ts`** (cookie.ts não pode importar `next/headers`, pois é usado no proxy).
- `session.ts` — DAL `server-only` + `cache()`: `createSession`, `getCurrentUser` (assinatura → DB → expiração → sliding `expires_at`), `destroySession`, `requireUser`, `requireAdmin`.
- `rate-limit.ts` — `INCR`+`EXPIRE` no Redis (`ratelimit:login:{ip}`), 5/15min → 429 (SPEC §3).

**Route Handlers (criar) — `src/app/api/auth/`** (Node runtime; `cookies()`/`request.json()` async)
- `login/route.ts` — `POST`: zod `{email,password}` → rate-limit por IP → user → `verifyPassword` → `createSession` + cookie assinado (httpOnly/Secure/SameSite=Lax/maxAge 7d) → 200 `{role}`; 401; 429.
- `logout/route.ts` — `POST`: lê cookie → apaga `Session` → limpa cookie → 200.
- `password/route.ts` — `POST` (autenticado): zod `{currentPassword,newPassword}` → `getCurrentUser` → valida atual → regrava hash → invalida outras sessões → 200/401.

**Proxy (criar)**
- `src/proxy.ts` — `config.matcher = ['/dashboard', '/dashboard/:path*']` (inclui o `/dashboard` exato além da subárvore). Verifica **assinatura HMAC** do cookie (sem DB) → inválido → `redirect('/login')`; em request válido re-seta cookie maxAge 7d (sliding do cookie). DB fica no DAL.

**Front-end (alterar)**
- `src/components/login/login-form.tsx` — `fetch('/api/auth/login')`; trata 401/429; sucesso → `/dashboard`.
- `src/app/page.tsx` — async, lê `readHomeSnapshot()` do Redis; `export const dynamic = 'force-dynamic'`.
- `src/app/dashboard/layout.tsx` — `await getCurrentUser()`; null → `redirect('/login')`; passa user ao sidebar.
- `src/components/layout/sidebar.tsx` — user real; esconde "Configurações" se `role==='client'`; botão logout → `POST /api/auth/logout`.
- `src/app/dashboard/configuracoes/page.tsx` — `await requireAdmin()` (client → redirect).

**Config**
- `package.json` — scripts `db:generate|db:migrate|db:reset|db:seed`, `typecheck`, bloco `"prisma": { "seed": "tsx prisma/seed.ts" }`; deps acima.
- `prisma/seed.ts` — upsert dos 2 usuários (creds fixas de dev, argon2id) + `writeHomeSnapshot()` + imprime credenciais. Idempotente.
- `.env` — definir `SESSION_SECRET` (≥32 chars); `.env.example` ganha nota.

## Impacto em PRD/SPEC e DOC.md

- **SPEC.md §1/§4** — documentar a home `/` servida de snapshot Redis (Postgres = fonte de verdade). PRD sem mudança.
- **DOC.md a criar/atualizar** (CLAUDE.md §2, só pastas tocadas): `src/lib/DOC.md`, `src/lib/auth/DOC.md`, `src/app/api/DOC.md`, `src/app/api/auth/DOC.md`, `src/app/DOC.md`, e `src/components/login/` + `src/components/layout/`. Backfill dos demais DOC.md ausentes = fora do escopo.

## Desenho dos testes

**Nenhum.** Decisão explícita do humano ("Nada"). Desvio consciente do CLAUDE.md §3/§5
(passo vermelho/TDD e infra real). Sem testes unit/integração/e2e nesta task; quando
features dependentes forem implementadas, suas specs reintroduzem os níveis aplicáveis.

## Fluxo de auth (resumo)

`login` cria `Session` + cookie assinado. `proxy.ts` (Node) faz o gate barato por
assinatura e desliza o cookie. O DAL (`getCurrentUser`) valida no DB, checa expiração
e desliza `expires_at`. `logout` apaga sessão + cookie. Papel aplicado no DAL
(`requireAdmin`) e no sidebar.

## Critérios de pronto

- Migration `init_auth` aplicada; `users` e `sessions` existem.
- `npm run db:reset` cria os 2 usuários e a chave `home:snapshot` no Redis; imprime credenciais.
- `/` renderiza dados vindos do Redis (apagar chave → fallback; re-seed → restaura).
- `/dashboard` deslogado → redireciona a `/login`. Login admin → dashboard + "Configurações" visível; login client → "Configurações" oculto e rota redireciona.
- Senha errada → 401; >5 tentativas → 429; logout limpa cookie; troca de senha permite re-login.
- `npm run lint` (Biome) e `npm run typecheck` (tsc) sem erros.
- `SPEC.md` atualizado (§1/§4) e DOC.md das pastas tocadas atualizados.
- Spec marcada `done` (atualizada se divergir).

## Verificação (manual — sem suíte)

`npm i` → `npm run db:reset` → `npm run dev`; percorrer os critérios acima; conferência
visual de login/logout via Playwright MCP (`browser_navigate`/`fill`/`click`).

## Estado da implementação (2026-06-15) — concluída

**Código completo + verificado.** Todos os arquivos do plano criados/alterados (com as
divergências acima). `npm run lint` (Biome) e `npm run typecheck` (tsc) **verdes**;
`prisma generate` ok (client v7.8.0).

**Migration & seed.** O Postgres (que estivera com erro de permissão no data dir do
servidor) voltou; `prisma migrate dev --name init_auth` criou/aplicou
`20260615225344_init_auth` (tabelas `users`/`sessions`). `npm run db:seed` (idempotente)
criou os 2 usuários e gravou `home:snapshot` no Redis. Confirmado no banco: `users` =
admin + client.

**Critérios de pronto — todos verificados:**
- Home `/` do Redis: com a chave → "GuiaGoals Dashboard" + AO VIVO + timestamp; **apagar a
  chave → fallback** ("GuiaGoals", sem selo); re-seed → restaura.
- `/dashboard` deslogado → **307 → /login** (proxy por assinatura).
- **Login admin** (Playwright) → dashboard com "Configurações" visível (`Administrador`).
- **Login client** (Playwright) → "Configurações" **oculta**; `/dashboard/configuracoes`
  → **redirect /dashboard** (`requireAdmin`).
- **Logout** → /login; reacessar `/dashboard` → /login (cookie limpo).
- **Senha errada** → 401 + alerta "Email ou senha inválidos.".
- **Rate-limit**: 5×401 e **6ª = 429** (curl).
- **Troca de senha** (curl): change 200 `{ok:true}`; senha antiga → 401; nova → 200.
  Senha de dev restaurada por re-seed após o teste.

Spec marcada **`done`**.

## Fora de escopo

Demais tabelas (goals/events/services/…), CRUD de metas, SSE/realtime, pub/sub Redis,
suíte de testes, backfill de DOC.md em pastas não tocadas.
