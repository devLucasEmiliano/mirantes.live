---
id: 021
title: Realtime (SSE) + cache de leitura via Redis — fan-out na mudança de dados
status: draft        # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-21
---

# 021 — Realtime (SSE) + cache de leitura (Redis)

## Objetivo

Hoje o Redis está **subutilizado** (só rate-limit de login e snapshot da home) e duas coisas que o
`SPEC.md` desenha nunca saíram do papel:

1. **Cache de leitura** — Home (`src/app/page.tsx`, `force-dynamic`) e Dashboard
   (`src/app/dashboard/page.tsx`) rodam **3+ queries Postgres a cada request, sem cache** (metas,
   contagem semanal de commits com 2 `COUNT`, eventos). Carga repetida e desnecessária.
2. **Realtime/SSE** — o SPEC desenha "Postgres → registra evento → **PUBLISH Redis → SSE**", mas o
   PUBLISH e o stream **não existem** (comentários "pendente da spec 014" em `redis.ts:5`,
   `events.ts:48`, `api/events/route.ts:9` — esse número foi reaproveitado). A Timeline só atualiza
   com reload.

Decisão (AskUserQuestion): tratar **as duas juntas**, porque compartilham o mesmo gatilho.

## Through-line — por que cache e SSE são UMA task

O instante em que o dado de um projeto muda já é único e bem definido no código:
- `syncProject` grava eventos em `sync.ts:188-201`;
- mutações de meta no service (`createGoal`/`updateGoal`/`archiveGoal`/`linkCommit`… em
  `src/lib/goals/service.ts`) emitem `goal.*`.

Esse instante vira um **fan-out único** — `onProjectDataChanged(projectId, events)` — com **dois
consumidores**:
- **(a) invalida** o cache de leitura daquele projeto (`invalidateProject`);
- **(b) publica** no canal Redis `goals:updates` → cada conexão SSE reenvia ao seu cliente.

Um ponto de fiação, dois efeitos. É a leitura literal do SPEC ("evento → PUBLISH → SSE"), e é o que
faz cache + realtime serem coerentes na mesma task em vez de duas fiações paralelas.

## Contexto e justificativa

- **Fail-open** é o padrão da casa: `home-snapshot.ts` e `rate-limit.ts` já degradam graciosamente se
  o Redis cai. `cached`/`publishEvents` seguem igual — Redis fora **nunca** quebra leitura nem sync.
- **Chave de cache só por `projectId`** (não por usuário): o controle de acesso roda **antes**
  (`resolveSelectedProject`/`getPublicProject`/`goalOwnerWhere`). O *conteúdo* (árvore de metas,
  contagem de commits, eventos visíveis de um projeto) não depende do papel de quem vê — o papel
  decide **quais** projetos você alcança, não o que cada projeto contém. Logo a chave por projeto é
  correta e simples. (Exceção: `listEvents` autenticado tem `where` por escopo de admin/cliente que
  inclui eventos globais `projectId:null` — esse caminho **não** é cacheado nesta task; cacheamos as
  leituras **por-projeto** — `listPublicEvents`, `listPublicGoals`/`listGoals(projectId)` e as
  contagens semanais.)
- **Pub/Sub no ioredis exige conexão dedicada**: uma conexão em modo `subscribe` não roda comandos
  normais. O singleton `redis` (`src/lib/redis.ts`) é o **publisher/command**; cada stream SSE abre
  `redis.duplicate()` como **subscriber** e o encerra no disconnect.
- **SSE (não WebSocket)**: o fluxo é unidirecional (servidor→cliente). `EventSource` reconecta
  sozinho. SSE basta e é mais simples no App Router.
- **TTL como rede de segurança**: mesmo sem invalidação (ex. mudança por caminho ainda não fiado), o
  cache expira em `CACHE_TTL_SECONDS` (default 30) e a leitura se auto-corrige.

## Dependência de ordem (CLAUDE.md §5.5)

Depende do sync já emitir eventos (existe) e da Timeline (012, verde). Roda **depois** da 020 (ambas
tocam `sync.ts`). Internamente: cache (parte A) e SSE (parte B) podem ser implementados na ordem
unit → integração → e2e da própria spec; a parte B (e2e) só fecha com a fiação do fan-out pronta.

## Mudanças de schema

Nenhuma. (Eventos já persistem em `Event`; Redis é cache/transporte, não fonte de verdade.)

## Arquivos a criar / alterar

### Criar
- **`src/lib/cache.ts`** — `cached`, `invalidateProject`, builders de chave (ver Contratos).
- **`src/lib/realtime/publish.ts`** — `publishEvents(projectId, events)` (PUBLISH fail-open).
- **`src/lib/realtime/scope.ts`** — `isVisibleToScope(scope, msg)` puro (filtro do stream).
- **`src/lib/realtime/fanout.ts`** — `onProjectDataChanged(projectId, events)` = invalida + publica.
- **`src/app/api/events/stream/route.ts`** — SSE (`runtime = "nodejs"`, `dynamic = "force-dynamic"`).
- **`src/components/shared/live-timeline.tsx`** (client) — wrapper que abre `EventSource` e prepend.
  Hook `useEventStream(projectId)` no mesmo arquivo ou em `src/lib/hooks/`.
- **`src/lib/realtime/DOC.md`**; testes (ver Desenho).

### Alterar
- **`src/lib/projects/public.ts`** — `publicWeeklyCommitStats` via `cached(weeklyKey(id), …)`.
- **`src/lib/projects.ts`** — `weeklyCommitStats` idem (mesma chave por projeto).
- **`src/lib/goals/service.ts`** — `listPublicGoals`/`listGoals(projectId)` via `cached`; cada mutação
  chama `onProjectDataChanged` (ou ao menos `invalidateProject`) após gravar.
- **`src/lib/events.ts`** — `listPublicEvents` via `cached(eventsKey(id), …)`.
- **`src/lib/github/sync.ts`** — após `db.event.createMany` (sync.ts:188-201), chamar
  `onProjectDataChanged(projectId, eventInputs)`.
- **`src/app/dashboard/page.tsx`** (e `src/app/page.tsx`) — trocar `<TimelineFeed>` pelo wrapper
  `<LiveTimeline initial=… projectId=…>`.
- **`src/lib/env.ts`** — `CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30)`.
- **`src/lib/redis.ts`, `src/lib/events.ts`, `src/app/api/events/route.ts`** — corrigir comentários
  "spec 014" → "spec 021" (PUBLISH/SSE agora existem).
- **`SPEC.md`** (realtime: canal `goals:updates`, SSE `/api/events/stream`, cache por projeto + TTL) e
  **`§12`** (env `CACHE_TTL_SECONDS`); **`PRD.md`** (Timeline ao vivo).
- **`playwright.config.ts`** — garantir `REDIS_URL` no `webEnv` (já deve existir) p/ o e2e do stream.

### DOC.md
- Criar `src/lib/realtime/DOC.md`; alterar `src/lib/DOC.md`, `src/lib/goals/DOC.md`,
  `src/lib/projects/DOC.md`, `src/components/shared/DOC.md`, `src/app/api/events/DOC.md`.

## Contratos

### `src/lib/cache.ts`
```ts
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

export const weeklyKey = (projectId: string) => `cache:weekly:${projectId}`;
export const goalsKey = (projectId: string) => `cache:goals:${projectId}`;
export const eventsKey = (projectId: string) => `cache:events:${projectId}`;

// GET→hit (JSON.parse); miss→loader()→SET EX ttl. Fail-open: qualquer erro de Redis → loader direto.
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    console.error("[cache] leitura falhou, indo ao loader:", err);
    return loader();
  }
  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("[cache] escrita falhou (ignorada):", err);
  }
  return value;
}

export async function invalidateProject(projectId: string): Promise<void> {
  try {
    await redis.del(weeklyKey(projectId), goalsKey(projectId), eventsKey(projectId));
  } catch (err) {
    console.error("[cache] invalidação falhou (ignorada):", err);
  }
}
export const CACHE_TTL = () => env.CACHE_TTL_SECONDS;
```

### `src/lib/realtime/scope.ts`
```ts
import type { Scope } from "@/lib/projects";

export interface UpdateMessage { projectId: string | null; }

// Admin vê tudo. Cliente vê eventos globais (projectId null) e dos próprios projetos.
// `ownedProjectIds` é resolvido pela rota antes de assinar (1 query), não aqui.
export function isVisibleToScope(
  scope: Scope,
  msg: UpdateMessage,
  ownedProjectIds: Set<string>,
): boolean {
  if (scope.role === "admin") return true;
  if (msg.projectId === null) return true;
  return ownedProjectIds.has(msg.projectId);
}
```

### `src/lib/realtime/publish.ts` / `fanout.ts`
```ts
export const UPDATES_CHANNEL = "goals:updates";
// publishEvents: redis.publish(UPDATES_CHANNEL, JSON.stringify({ projectId, events })) — fail-open.
// onProjectDataChanged: await invalidateProject(projectId); await publishEvents(projectId, events);
```

### `src/app/api/events/stream/route.ts` (esqueleto)
```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// GET: sessão (401 se anônimo) → resolve ownedProjectIds → redis.duplicate().subscribe(UPDATES_CHANNEL)
// → ReadableStream que escreve `data: ${json}\n\n` p/ msgs que passam em isVisibleToScope,
// heartbeat `: ping\n\n` a cada ~25s, e no request.signal 'abort' → unsubscribe + quit + close.
```

## Impacto em PRD/SPEC

- **SPEC (Realtime):** canal Redis `goals:updates`; endpoint SSE `GET /api/events/stream` (nodejs,
  conexão `duplicate()` por cliente, heartbeat 25s); fan-out `onProjectDataChanged` no sync e nas
  mutações de meta. Atualiza os "pendente da spec 014".
- **SPEC §12:** `CACHE_TTL_SECONDS` (default 30). Cache de leitura por `projectId`
  (`cache:weekly|goals|events:{id}`), invalidado no fan-out, TTL como rede de segurança.
- **PRD:** Timeline da Visão Geral e da Home pública atualizam **ao vivo** (sem reload).

## Desenho dos testes (test_levels: [unit, integration, e2e])

**Passo vermelho (§5.4):** testes escritos contra módulos/rota **ausentes** → falham antes da feature.
Infra real onde a §5.3 exige (Redis real para cache e Pub/Sub; Postgres real no efeito do sync). Nada
de fake in-memory de Redis.

### Unit
`tests/unit/cache.test.ts` — com `redis` **mockado** (vi.mock do módulo `@/lib/redis`, pois aqui testo
a *lógica* de `cached`, não o Redis):
- **hit** (get devolve JSON) → retorna parseado e **não** chama o loader (`loader` é um spy);
- **miss** → chama loader 1×, faz `set` com `EX ttl`, retorna o valor;
- **fail-open**: `get` rejeita → loader roda e o resultado volta (sem lançar).

`tests/unit/realtime-scope.test.ts` — `isVisibleToScope`:
- admin → sempre `true` (inclusive projeto alheio);
- cliente + `projectId` null (global) → `true`;
- cliente + projeto próprio → `true`; projeto alheio → `false`.

### Integração (Redis real + Postgres real, §5.3)
`tests/integration/cache-redis.test.ts`:
- `cached` round-trip: 1ª chamada popula, 2ª lê do Redis sem chamar o loader (spy conta 1);
- `invalidateProject` apaga `cache:weekly|goals|events:{id}` (assert `redis.exists` = 0).

`tests/integration/realtime-pubsub.test.ts`:
- `publishEvents` numa conexão e recepção numa `redis.duplicate()` assinante → payload recebido
  bate (`projectId` + `events`). (Usa um `await` por promessa de mensagem com timeout do vitest.)

`tests/integration/sync-fanout.test.ts`:
- semeia `cache:events:{id}` no Redis; roda `syncProject` com commit novo (stub) → a chave **sumiu**
  (fan-out invalidou) e um PUBLISH foi emitido (assinante recebe). Reusa `makeStubClient`.

### E2E (Playwright) — `tests/e2e/timeline-realtime.spec.ts`
- Admin logado abre `/dashboard`; em paralelo dispara uma mudança (editar uma meta pela UI **ou** o
  botão "Sincronizar Agora" → `POST /api/projects/:id/sync`); a Timeline ganha o novo item **sem
  reload** (assert via `expect(locator).toContainText(...)` com auto-wait). `GITHUB_SYNC_AUTOSTART=0`
  (a mudança é a ação explícita, não o loop). Ver memória `e2e-needs-dev-server-stopped`.

## Critérios de pronto

- [ ] Unit/integração/e2e vistos **vermelhos** (módulos/rota ausentes) → **verdes** sem alterar testes;
      ordem §5.5 respeitada.
- [ ] Redis real na integração (cache round-trip, invalidação, pub/sub); Postgres real no fan-out.
- [ ] Fail-open provado: cache com Redis lançando → loader roda (unit verde); sync não quebra sem Redis.
- [ ] SSE: `duplicate()` por conexão, `unsubscribe`+`quit` no abort (sem vazar conexão), heartbeat.
- [ ] `tsc --noEmit` e Biome limpos; comentários "spec 014" corrigidos.
- [ ] `DOC.md` das pastas tocadas + `SPEC.md`/`PRD.md` atualizados; spec marcada `done` se divergir.

## Fora de escopo

- Cache de leituras autenticadas com eventos **globais** (`listEvents` por escopo) — fica por-projeto;
  o caminho global continua direto ao Postgres.
- Presença / "quem está online", reações, contadores ao vivo — só a Timeline transmite.
- WebSocket / canal bidirecional (SSE basta).
- Cache de páginas inteiras (Next `unstable_cache`/`revalidateTag`) — ficamos no cache de dados em
  Redis, sob nosso controle de invalidação pelo fan-out.
- Escalar o SSE entre múltiplas instâncias além do que o Pub/Sub do Redis já dá (sticky sessions,
  back-pressure avançado) — fora do escopo atual.

> **Nota de escopo:** esta é a maior das duas tasks (cache + Pub/Sub + SSE + frontend + e2e). Mantida
> combinada por coerência (um fan-out, dois consumidores). Se preferir reduzir o risco do passo de
> implementação, dá para fatiar em **021 (cache)** e **022 (SSE)** — basta avisar na aprovação.
