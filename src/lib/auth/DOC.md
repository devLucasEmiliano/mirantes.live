# src/lib/auth

## Propósito
Autenticação por sessão (SPEC §3): hash de senha argon2id, cookie de sessão assinado
por HMAC, DAL que valida a sessão contra o Postgres e rate-limit de login no Redis.

## Estrutura
Quatro módulos, sem subpastas. `cookie.ts` é **puro** (usável no `proxy.ts`); o resto
é servidor (`session.ts` é `server-only`).

## Arquivos
- **`password.ts`** — `hashPassword()` / `verifyPassword()` via `@node-rs/argon2`
  (argon2id é o padrão; params ~OWASP 2024). Sem estado.
- **`cookie.ts`** — funções **puras** do cookie (sem `next/headers`): `signSessionToken`,
  `verifySessionToken` (HMAC-SHA256 time-safe), `SESSION_COOKIE_NAME`,
  `SESSION_MAX_AGE_SECONDS`, `buildSessionCookieOptions()` (`Secure` só em produção).
  Compartilhado entre o DAL e o `proxy.ts`.
- **`session.ts`** — DAL (`server-only` + React `cache`): `createSession` (cria linha
  `sessions` + grava cookie), `getCurrentUser` (assinatura → banco → expiração →
  sliding de `expires_at`), `destroySession` (logout), `requireUser`, `requireAdmin`
  (redirecionam). Fonte de verdade da identidade.
- **`rate-limit.ts`** — `checkLoginRateLimit(identifier)` + `clearLoginRateLimit` com
  `INCR`/`EXPIRE`/`DEL` no Redis (`ratelimit:login:<id>`, 5/15min → 429). O login aplica
  em duas dimensões — `ip:<ip>` e `email:<email>` (esta imune a IP forjado). Fail-open se
  o Redis cair.
- **`create-user.ts`** — provisionamento de conta fora do seed (PRD §2: contas só por
  seed/script, sem cadastro público). `createUser(email, role, name?)` gera senha
  aleatória (`randomBytes`), faz hash e cria a linha (`create`, não `upsert` — email
  duplicado falha alto em vez de sobrescrever). Auto-run via
  `bun run src/lib/auth/create-user.ts <email> [admin|client] [nome]` (script
  `user:create`): imprime a senha **uma única vez** no terminal; nunca fica em texto no
  repo.

## O que NÃO vai aqui
- **`cookie.ts` não pode importar `next/headers`** — precisa rodar no proxy. Setar/limpar
  cookie via `cookies()` mora em `session.ts`.
- **Sem componentes/JSX**; sem `"use client"`.
- Autorização específica de recurso (ex.: filtro `visible_to_client`) fica nos Route
  Handlers/queries das suas specs, não aqui.
