---
id: 012
title: Eventos (timeline) + commits/CI no feed + seletor de projeto funcional
status: done         # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-17
---

# 012 — Eventos + Timeline (commits/CI) + Seletor de projeto

## Objetivo

Tornar a **Timeline** (`/dashboard/timeline`) e a **"Atividade Recente"** (`/dashboard`) **reais**,
alimentadas pela tabela **`events`** (SPEC §2.4), e fazer o **seletor de projeto** do header trocar
o contexto de fato (filtrando dashboard + timeline). Nesta spec só há fonte de dado real para
**commits** e **CI/CD (workflow runs)** — já persistidos pelo sync (spec 008/009). Concretamente:

1. **Tabela `events`** (com `project_id` — divergência registrada em §"Impacto") como feed unificado
   e âncora de `Last-Event-ID` para o SSE (spec 014).
2. **Emissão no sync** (`syncProject`): **1 evento por commit novo** (`commit.created`) e **1 evento
   por workflow run ao concluir** (`ci.run`, na transição para `completed`). Idempotente: re-sync não
   reemite. Substitui o `// TODO(spec-timeline)` de `sync.ts`.
3. **Backfill** dos commits/runs **já no banco** (que nasceram antes desta spec) para a timeline não
   começar vazia.
4. **Leitura**: `listEvents(scope, {projectId?, cursor?, limit})` + `GET /api/events` (paginado;
   cliente só vê `visible_to_client`).
5. **Seletor de projeto funcional**: dropdown lista os projetos do escopo, persiste a escolha em
   cookie (`selected_project_id`) via Server Action, e dashboard/timeline passam a **filtrar pelo
   projeto selecionado** (fallback = projeto mais antigo, comportamento atual).
6. **Limpeza do dashboard**: **remover** o card "Último commit sincronizado" (passa a aparecer na
   Atividade Recente).

## Contexto e justificativa

- Hoje `/dashboard/timeline` (`timeline-view.tsx`) e a Atividade Recente (`timeline-feed.tsx`)
  renderizam `mockEvents` (`src/lib/mock-data.ts`); o seletor (`project-switcher.tsx`) é um **botão
  inerte** que mostra o projeto mais antigo ("Neuron") sem trocar nada; o card "último commit"
  (`dashboard/page.tsx:110-125`) é real mas redundante com a Atividade Recente.
- **Realidade do banco:** só `commits` e `workflow_runs` têm dado real. **Não existem** `events`,
  `goals`, `services`/`incidents`. Por isso **metas** e **incidentes** **não** entram aqui — viram
  specs próprias (CLAUDE.md §5.5: "Timeline depende de eventos de metas; só implementar com a base
  testada e verde"). A UI já trata os 3 `source` (goal/commit/incident); aqui só `commit` emite.
- `sync.ts` já deixou o gancho exato: `// TODO(spec-timeline): emitir evento commit.batch +
  PUBLISH goals:updates` (linha 116). Esta spec preenche a 1ª metade (emitir eventos); o `PUBLISH`
  no Redis fica para a **spec 014 (SSE)**.

> **Roadmap (decidido com o humano neste chat).** Esta é a **1ª de 3 specs** desta leva:
> **012** (esta) → **013 Metas reais** (`goals` + CRUD + `goal.*`) → **014 SSE** (`/api/stream` +
> Redis Pub/Sub + EventSource). Incidentes/monitoramento = spec futura. Plano-mapa em
> `.claude/plans/perfeito-agora-que-temos-memoized-charm.md`.

> **Numeração:** o roadmap citava "011", mas `.specs/011-pixelblast-fundo-home.md` já existe →
> esta é **012**; Metas **013**; SSE **014**.

> **Documentos-fonte:** `.docs/PRD.md` e `.docs/SPEC.MD`. **Tooling (CLAUDE.md §0):** **Bun**
> (`bun install`, `bunx <bin>`, `bun run <script>`). **Nunca `npm`/`npx`/`yarn`/`pnpm`.**
> **AGENTS.md:** este Next.js tem breaking changes — ler `node_modules/next/dist/docs/` (`cookies()`
> em Server Components/Server Actions) **antes** de codar o seletor.

## Dependência de ordem (CLAUDE.md §5.5)

Depende do harness verde das specs 007/008/009 (Vitest + Playwright + Postgres/Redis reais; sync com
stub injetável). **Não** depende de metas (013) nem de SSE (014) — é a fundação que as duas
consomem. A timeline aqui é **real mas não ao vivo** (lê do banco a cada carga/navegação); o "AO
VIVO" só passa a funcionar na 014.

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

1. **Granularidade:** **1 evento por commit** (`commit.created`) + **CI ao concluir** (`ci.run` na
   transição p/ `completed`).
2. **Seletor filtra tudo:** trocar projeto no header filtra dashboard + timeline → `events` ganha
   `project_id`; escolha persistida em cookie.
3. **Metas de verdade** e **SSE ao vivo** entram, mas como **specs 013/014** (não aqui).
4. **Remover** o card "último commit" do dashboard.
5. **Home pública real (decidido neste chat, pós-`/clear`):** o feed "Atividade Recente" da
   home (`/`, deslogado) passa a mostrar **eventos reais** do **projeto-vitrine** = o **mais
   antigo de um admin** (casa com o snapshot público), **só `visibleToClient:true`**.
   Cards/metas/uptime da home **seguem mock** (goals=013, monitoramento=futuro). Como dashboard
   **e** home passam a usar eventos reais, **`mockEvents` é REMOVIDO** de `mock-data.ts` (deixa
   de existir consumidor) e o `TimelineEvent` muda livremente.

### Divergência aprovada — Home pública lê eventos reais (registro §3.2)

> Expande o plano original (que só tornava dashboard+timeline reais). A home é **pública/sem
> `Scope`** → exige um leitor próprio que **força `visibleToClient:true`** (visitante anônimo é
> menos privilegiado que `client`). Também dobra a regra "home = só snapshot do Redis" (SPEC §4):
> a home `force-dynamic` passa a **ler o Postgres**; o read **degrada p/ feed vazio** (try/catch)
> se o banco falhar, preservando o fallback estático do snapshot. **`EventDTO` = `TimelineEvent`**
> (um único shape: `id` string, `createdAt` ISO) — sem DTO paralelo.

- **`src/lib/events.ts`** ganha `listShowcaseEvents(limit=7): Promise<TimelineEvent[]>` — acha o
  projeto-vitrine (`db.project.findFirst({ where:{ user:{ role:"admin" } }, orderBy:{ createdAt:"asc" } })`),
  devolve seus eventos `visibleToClient:true`, `orderBy id desc`, `take limit`. Sem projeto → `[]`.
- **`src/app/page.tsx`** — troca `mockEvents.filter(...)` por `await listShowcaseEvents(7)` (try/catch
  → `[]`); `TimelineFeed` passa a receber eventos reais (formata via `events/format.ts`).
- **`src/lib/mock-data.ts`** — **remove** `mockEvents` (e o import de `TimelineEvent`). `mockGoals`/
  `mockSummary`/`mockServices`/`mockIncidents` ficam.
- **Testes novos:**
  - Integração (`tests/integration/events-showcase.test.ts`): vitrine = projeto mais antigo de um
    admin; retorna só `visibleToClient:true` dele; ignora projeto de client, projeto admin mais novo
    e eventos invisíveis; sem projeto de admin → `[]`.
  - E2E (`tests/e2e/home.spec.ts`): `/` deslogado mostra um commit real visível ("feat: pré-seed
    e2e") e **não** mostra um evento `visibleToClient:false` semeado na vitrine.
- **Seed e2e:** `seed-events.ts` cria também 1 evento oculto (`visibleToClient:false`) no projeto
  vitrine p/ provar o filtro público.
- **Docs:** SPEC §4 (home lê vitrine real do Postgres, visível-only) + PRD §6/§1 (Atividade Recente
  da home real; cards/metas/uptime seguem mock).

## Fora de escopo (specs futuras)

- **Metas reais** (`goals`, CRUD, `goal.*`) → **013**. Até lá, `mockGoals` segue no dashboard/metas e
  o painel "METAS MAIS ATIVAS" da timeline fica **oculto** (sem mock).
- **SSE/realtime** (`/api/stream`, `PUBLISH goals:updates`, EventSource, `Last-Event-ID`) → **014**.
- **Incidentes/monitoramento** (`services`/`incidents`/probes) → spec futura. `source:'incident'` não
  emite nada aqui.
- **`PATCH /api/events/:id`** (admin alterna `visible_to_client`) — coluna + filtro existem, mas a UI
  de toggle fica p/ quando houver tela de admin de eventos.
- Janela "PERÍODO" (De/Até) e "RESUMO DA SEMANA" da timeline: o resumo passa a derivar de `events`
  (contagens 7d); o seletor de datas continua estático (refinar depois).

---

## Arquivos a criar / alterar

### Schema, migração
- **Alterar** `prisma/schema.prisma` — novo modelo `Event` (abaixo) + relação `events Event[]` em
  `Project`. Migração `bunx prisma migrate dev --name events_timeline` **seguida de**
  `bunx prisma generate` (Prisma 7 — ver nota da spec 007/008).

### Camada de eventos (NOVA) — `src/lib/events/`
- **`emit.ts`** (puro, unit-testável) — converte commit/run em **entrada de evento** e decide quando
  emitir CI:
  - `commitToEvent(projectId, repo, c: MappedCommit): EventInput`.
  - `runToEvent(projectId, run: GhWorkflowRun): EventInput`.
  - `shouldEmitRunEvent(prev: {status} | null, incoming: {status}): boolean` (transição→`completed`).
  - `runConclusionLabel(run): string` (pt: sucesso/falhou/cancelado/concluído via `deriveRunStatus`).
- **`format.ts`** (puro, unit-testável) — `eventDateGroup(date, now): string`
  ("Hoje — 11 Jun 2026" / "Ontem — …" / "11 Jun 2026") e `eventTime(date): string` ("14:32").
- **`backfill.ts`** — `backfillEvents(): Promise<{ commits: number; runs: number }>` idempotente:
  cria `commit.created` p/ commits sem evento e `ci.run` p/ runs `completed` sem evento (dedupe por
  `type`+`refId`), em ordem **ascendente** de tempo (ids cronológicos). `bun run`.
- **`../events.ts`** — `listEvents(scope, {projectId?, cursor?, limit})`: `where` por escopo
  (cliente: `visibleToClient:true` **e** projeto próprio ou `projectId:null`; admin: tudo), filtro por
  `projectId`, `orderBy id desc`, cursor `id < cursor`. DTO serializa `id` com `String()` e
  `createdAt` ISO. Devolve `{ events: EventDTO[]; nextCursor: string | null }`.

### Seletor de projeto
- **`src/lib/projects/select.ts`** — Server Action `selectProject(projectId)` (`"use server"`):
  valida pertencimento via `getProject(projectId, scope)`; grava cookie `selected_project_id`
  (`SameSite=Lax`, `path:/`). Função pura `pickSelectedProject(projects, cookieVal)` (unit) +
  `resolveSelectedProject(scope)` (lê `cookies()` + `listProjects` + `pickSelectedProject`; fallback =
  mais antigo).

### Endpoints
- **`src/app/api/events/route.ts`** — `GET` (auth → `listEvents`; querystring `projectId?`/`cursor?`/
  `limit?` validada com zod). Handler fino, padrão dos demais.

### Frontend
- **`src/lib/types.ts`** — `TimelineEvent`: `id: number→string`, **remover** `timestamp: string`,
  **adicionar** `createdAt: string (ISO)`. (Os componentes formatam via `events/format.ts`.)
- **`src/components/layout/app-header.tsx`** (server) — buscar `listProjects(scope)` + `resolveSelectedProject(scope)`; passar `projects` + `selectedId` ao switcher. Continua escopado por papel.
- **`src/components/layout/project-switcher.tsx`** → **client component** (`"use client"`): dropdown
  com os projetos; ao escolher chama `selectProject` (Server Action) + `router.refresh()`. `data-testid`:
  `project-switcher`, `project-option`.
- **`src/components/timeline/timeline-view.tsx`** — trocar `dateGroupOf`/`timeOf` hardcoded
  (linhas 51-61) por `eventDateGroup`/`eventTime`; **ocultar** "METAS MAIS ATIVAS"; "RESUMO DA SEMANA"
  passa a receber contagens reais por prop. Recebe `events: TimelineEvent[]` + `nextCursor` e carrega
  mais via `GET /api/events`.
- **`src/components/shared/timeline-feed.tsx`** — `TimelineEventRow` usa `eventTime(new Date(createdAt))`
  no lugar de `event.timestamp`.
- **`src/app/dashboard/timeline/page.tsx`** (server) — `scope` + `resolveSelectedProject`;
  `listEvents(scope, {projectId, limit:30})` → `TimelineView`. Sem `mockEvents`.
- **`src/app/dashboard/page.tsx`** (server) — **remover** o bloco "Último commit sincronizado"
  (110-125) + `latestCommit`/`relativeTime` órfãos; Atividade Recente recebe `listEvents(scope,
  {projectId, limit:7})`; `weeklyCommitStats` passa a aceitar o `projectId` selecionado.
- **`src/lib/projects.ts`** — `weeklyCommitStats`/`latestCommit` aceitam `projectId?` opcional (além
  do `scope`) p/ o filtro do seletor. `latestCommit` permanece (usado por testes/back-compat), só não
  é mais renderizado.

### Harness de testes
- **Alterar** `tests/setup/db.ts` — `truncateAll` inclui `events` (bigint identity → `RESTART IDENTITY`).
- **Criar** `tests/unit/events-map.test.ts`, `tests/unit/events-format.test.ts`,
  `tests/unit/selected-project.test.ts`, `tests/integration/events-sync.test.ts`,
  `tests/integration/events-list.test.ts`, `tests/e2e/timeline.spec.ts`,
  `tests/e2e/seed-events.ts`.
- **Alterar** `tests/e2e/global-setup.ts` — após `seed-activity`/`seed-connections`, rodar
  `bun run tests/e2e/seed-events.ts` (2º projeto do admin + `backfillEvents()`).

---

## Mudanças de schema (`prisma/schema.prisma`)

```prisma
/// Timeline unificada (SPEC §2.4). `id` bigint monotônico = âncora de Last-Event-ID (SSE, spec 014).
/// DIVERGÊNCIA do SPEC: ganha `project_id` (nullable) p/ o seletor filtrar por projeto (ver Impacto).
model Event {
  id              BigInt   @id @default(autoincrement())
  source          String   // goal | commit | incident
  type            String   // commit.created | ci.run | goal.* | incident.*
  refId           String?  @map("ref_id")               // sha do commit / String(run_id) / goal id
  projectId       String?  @map("project_id") @db.Uuid  // null = evento global (ex. meta sem projeto)
  project         Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title           String
  detail          String?
  visibleToClient Boolean  @default(true) @map("visible_to_client")
  createdAt       DateTime @default(now()) @map("created_at") // = tempo da ATIVIDADE (commit/run)
  @@index([createdAt(sort: Desc)])
  @@index([visibleToClient, createdAt(sort: Desc)])
  @@index([projectId, createdAt(sort: Desc)])
  @@map("events")
}
```
`Project` ganha `events Event[]`. `id` é **BigInt → não é JSON-safe**: o DTO serializa com
`String(id)` (mesmo padrão de `WorkflowRun.runId`).

> **Ordenação e cursor:** a lista ordena por **`id desc`** (inserção). `createdAt` carrega o **tempo da
> atividade** (commit `committedAt` / run `updated_at`) só p/ exibir/agrupar por dia. O **backfill
> insere em ordem ascendente de tempo** → ids ficam cronológicos; syncs incrementais acrescentam ids
> maiores. (Caveat: um commit antigo descoberto **depois** de outros mais novos ordena por descoberta,
> não por data de autoria — raro; aceitável; mantém o `id` como âncora simples do SSE.)

### `syncProject` — emissão (substitui o `// TODO(spec-timeline)`)

Após persistir commits/branches/runs, **antes do retorno**:

1. **Commits:** computar os **novos SHAs** = (lote) − (já existentes no banco p/ o projeto), via
   `db.commit.findMany({ where:{ projectId, sha:{ in: shas } }, select:{ sha } })` **antes** do
   `createMany`. Para cada novo, `commitToEvent(projectId, project.repo, mapped)` →
   `db.event.createMany`.
2. **CI:** trocar o loop de `upsert` por **findUnique → decidir → upsert**: se
   `shouldEmitRunEvent(prev, incoming)` (incoming `completed` e prev inexistente **ou** não-`completed`),
   acumular `runToEvent(projectId, run)` e `createMany` ao fim.
3. **Sem transação/PUBLISH aqui** — manter o estilo sequencial atual; o wrapper transacional +
   `PUBLISH goals:updates` entra na **014**.

`EventInput`:
- commit → `{ source:'commit', type:'commit.created', refId: sha, projectId, title: subject,
  detail: '<autor> · <repo>', visibleToClient: true, createdAt: committedAt }`.
- run (completed) → `{ source:'commit', type:'ci.run', refId: String(run.id), projectId,
  title: 'CI <name> #<run_number>: <sucesso|falhou|cancelado|concluído>', detail: 'branch <head_branch>',
  visibleToClient: true, createdAt: new Date(run.updated_at) }`.

---

## Impacto em PRD/SPEC e DOC.md

### `.docs/SPEC.MD`
- **§2.4 `events`** — adicionar `project_id uuid null` (e índice `(project_id, created_at desc)`);
  registrar os `type` desta leva: `commit.created`, `ci.run` (e os `goal.*` virão na 013). Remover/ajustar
  a nota de §2.8 que diz "events… aqui ainda são globais" → agora têm `project_id` nullable.
- **§4** — adicionar `GET /api/events` já existente na tabela como **implementado** (era pendente);
  nota: `PUBLISH`/SSE seguem pendentes da 014.
- **§7** — o item "Lote de novos commits → evento + PUBLISH … pendente" passa a: **eventos
  emitidos** (`commit.created` por commit, `ci.run` ao concluir); `PUBLISH` ainda pendente (014).

### `.docs/PRD.md`
- **§6 (Timeline)** — feed real de commits + CI por projeto; metas/incidentes entram nas suas specs.
- **§ (Projetos/Header)** — documentar a **troca de contexto** do seletor (cookie `selected_project_id`,
  fallback = projeto mais antigo) — comportamento visível novo.

### DOC.md (CLAUDE.md §2)
- **Criar:** `src/lib/events/DOC.md`, `src/app/api/events/DOC.md`, `src/lib/projects/DOC.md`.
- **Atualizar:** `src/lib/DOC.md` (novo `events.ts` + `events/`), `src/app/dashboard/timeline/DOC.md`
  (real, não mock; sem SSE ainda), `src/app/dashboard/DOC.md` (sem card "último commit"; Atividade
  Recente real), `src/components/layout/DOC.md` (switcher funcional), `src/components/timeline/DOC.md`,
  `src/components/shared/DOC.md`, `src/app/api/DOC.md`.

---

## Desenho dos testes

`test_levels: [unit, integration, e2e]`. **Infra real (§5.3):** Postgres/Redis reais; **GitHub é o
único externo → stub por injeção** (`makeStubClient`, fixtures `ghCommit`/`ghRun`). Limpeza por
`truncateAll` entre testes.

**Passo vermelho (§5.4):** criar `emit.ts`/`format.ts`/`events.ts`/`select.ts`/`backfill.ts` como
**stubs sentinela** (puros devolvem neutro: `commitToEvent`/`runToEvent`→objeto vazio
`{} as EventInput`, `shouldEmitRunEvent`→`false`, `eventDateGroup`/`eventTime`→`""`,
`pickSelectedProject`→`null`; `listEvents`→`{events:[],nextCursor:null}`) e **não** emitir eventos no
sync → rodar → **falham nas asserções concretas** → `status: tests-red` → implementar até verde **sem
alterar os testes**. Validar 1× quebrando a dedupe de emissão de propósito (re-sync passa a duplicar)
p/ confirmar que o teste pega.

### Casos — Unit
| função | entrada | esperado |
|---|---|---|
| `commitToEvent` | `(p, "mirantes.live", {sha:"a1",message:"feat: x",author:"Ana",committedAt:D})` | `{source:"commit",type:"commit.created",refId:"a1",projectId:p,title:"feat: x",detail:"Ana · mirantes.live",visibleToClient:true,createdAt:D}` |
| `runToEvent` | `ghRun(7,{name:"CI",run_number:7,status:"completed",conclusion:"failure",head_branch:"main"})` | `type:"ci.run"`, `refId:"7"`, `title:"CI CI #7: falhou"`, `detail:"branch main"`, `createdAt:Date(updated_at)` |
| `shouldEmitRunEvent` | `(null,{status:"completed"})` / `({status:"in_progress"},{status:"completed"})` / `({status:"completed"},{status:"completed"})` / `(null,{status:"in_progress"})` | `true` / `true` / `false` / `false` |
| `runConclusionLabel` | success/failure/cancelled/null(completed) | sucesso/falhou/cancelado/concluído |
| `eventTime` | `Date(2026,5,11,14,32)` | `"14:32"` |
| `eventDateGroup` | `(Date(2026,5,11,9,0), now=Date(2026,5,11,18,0))` / ontem / 3 dias atrás | `"Hoje — 11 Jun 2026"` / começa com `"Ontem —"` / `"8 Jun 2026"` (sem "Hoje/Ontem") |
| `pickSelectedProject` | `([{id:"p1",..},{id:"p2",..}], "p2")` / `(…, "alheio")` / `(…, null)` / `([], "x")` | p2 / p1 (fallback) / p1 / `null` |

### Casos — Integração (`syncProject` emite, Postgres real, GitHub stub)
- **1º sync** (3 commits, 2 runs completed) → **5 eventos**: 3 `commit.created` (refId = sha,
  `createdAt = committedAt`, detail com repo) + 2 `ci.run` (refId = String(run.id)).
- **re-sync idêntico** → **nenhum evento novo** (commits dedupe; runs já `completed`).
- **transição de run**: 1º sync run `in_progress` → **0** `ci.run`; 2º sync mesma run `completed` → **1**.
- **commit novo no 2º sync** → exatamente **1** `commit.created` novo.

### Casos — Integração (`listEvents`, Postgres real)
- **escopo**: cliente vê só eventos de **projeto próprio** (ou `projectId:null`) **e** `visibleToClient`;
  admin vê tudo.
- **visibilidade**: evento `visibleToClient:false` some p/ cliente, aparece p/ admin.
- **filtro por projeto**: `{projectId}` devolve só os daquele projeto.
- **cursor**: `limit:2` devolve 2 + `nextCursor`; a página seguinte continua de onde parou; fim →
  `nextCursor:null`.
- **ordem**: `id desc` (mais novo primeiro).

### Casos — E2E (Playwright, app + DB de teste pré-semeado com `seed-events`)
- **admin** em `/dashboard/timeline` vê um **commit real** ("feat: pré-seed e2e") e um **`ci.run`**
  ("CI CI #1: sucesso").
- **admin troca de projeto** no header (2 projetos semeados) → o feed passa a mostrar o commit do 2º
  projeto e **some** o do 1º.
- **`/dashboard`** **não** tem "Último commit sincronizado"; a **Atividade Recente** mostra um commit real.
- **cliente** em `/dashboard/timeline` **não** vê o commit do projeto do admin (escopo).

---

## Os testes (código)

> Escritos para **falhar** antes da feature existir. Vitest/Playwright importados explicitamente
> (sem globals), casando com o Biome.

### `tests/setup/db.ts` (alterar `truncateAll`)
```ts
export async function truncateAll(): Promise<void> {
  // `projects` CASCADE limpa commits/branches/workflow_runs/events (FK→projects);
  // `events` no TRUNCATE zera também os eventos globais (project_id NULL) e a identity (bigint).
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "users", "projects", "events" RESTART IDENTITY CASCADE`,
  );
}
```

### `tests/unit/events-map.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  commitToEvent,
  runConclusionLabel,
  runToEvent,
  shouldEmitRunEvent,
} from "@/lib/events/emit";
import { ghRun } from "../setup/github";

describe("commitToEvent", () => {
  it("mapeia um commit para evento commit.created", () => {
    const committedAt = new Date("2026-06-10T12:00:00Z");
    const ev = commitToEvent("p1", "mirantes.live", {
      sha: "a1", message: "feat: x", author: "Ana", committedAt,
    });
    expect(ev).toEqual({
      source: "commit", type: "commit.created", refId: "a1", projectId: "p1",
      title: "feat: x", detail: "Ana · mirantes.live", visibleToClient: true, createdAt: committedAt,
    });
  });
});

describe("runToEvent", () => {
  it("mapeia uma run concluída em falha", () => {
    const run = ghRun(7, { name: "CI", run_number: 7, conclusion: "failure", head_branch: "main",
      updated_at: "2026-06-10T12:05:00Z" });
    const ev = runToEvent("p1", run);
    expect(ev.source).toBe("commit");
    expect(ev.type).toBe("ci.run");
    expect(ev.refId).toBe("7");
    expect(ev.title).toBe("CI CI #7: falhou");
    expect(ev.detail).toBe("branch main");
    expect(ev.createdAt).toEqual(new Date("2026-06-10T12:05:00Z"));
  });
});

describe("shouldEmitRunEvent (emite só na transição p/ completed)", () => {
  it("run nova já completed → emite", () =>
    expect(shouldEmitRunEvent(null, { status: "completed" })).toBe(true));
  it("in_progress → completed → emite", () =>
    expect(shouldEmitRunEvent({ status: "in_progress" }, { status: "completed" })).toBe(true));
  it("completed → completed (re-sync) → não emite", () =>
    expect(shouldEmitRunEvent({ status: "completed" }, { status: "completed" })).toBe(false));
  it("ainda não concluída → não emite", () =>
    expect(shouldEmitRunEvent(null, { status: "in_progress" })).toBe(false));
});

describe("runConclusionLabel", () => {
  it("success", () => expect(runConclusionLabel({ status: "completed", conclusion: "success" })).toBe("sucesso"));
  it("failure", () => expect(runConclusionLabel({ status: "completed", conclusion: "failure" })).toBe("falhou"));
  it("cancelled", () => expect(runConclusionLabel({ status: "completed", conclusion: "cancelled" })).toBe("cancelado"));
  it("sem conclusion → concluído", () =>
    expect(runConclusionLabel({ status: "completed", conclusion: null })).toBe("concluído"));
});
```

### `tests/unit/events-format.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { eventDateGroup, eventTime } from "@/lib/events/format";

// Datas construídas no fuso LOCAL (year, monthIndex, day, h, m) → estáveis em qualquer TZ.
describe("eventTime", () => {
  it("HH:MM 24h com zero à esquerda", () => {
    expect(eventTime(new Date(2026, 5, 11, 14, 32))).toBe("14:32");
    expect(eventTime(new Date(2026, 5, 11, 9, 5))).toBe("09:05");
  });
});

describe("eventDateGroup", () => {
  const now = new Date(2026, 5, 11, 18, 0);
  it("mesmo dia → Hoje", () =>
    expect(eventDateGroup(new Date(2026, 5, 11, 9, 0), now)).toBe("Hoje — 11 Jun 2026"));
  it("dia anterior → Ontem", () =>
    expect(eventDateGroup(new Date(2026, 5, 10, 23, 0), now)).toMatch(/^Ontem — 10 Jun 2026$/));
  it("mais antigo → só a data", () => {
    const g = eventDateGroup(new Date(2026, 5, 3, 9, 0), now);
    expect(g).toBe("3 Jun 2026");
    expect(g).not.toMatch(/Hoje|Ontem/);
  });
});
```

### `tests/unit/selected-project.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { pickSelectedProject } from "@/lib/projects/select";

const projects = [
  { id: "p1", name: "Alpha" },
  { id: "p2", name: "Beta" },
];

describe("pickSelectedProject", () => {
  it("cookie válido → o projeto escolhido", () =>
    expect(pickSelectedProject(projects, "p2")).toEqual({ id: "p2", name: "Beta" }));
  it("cookie de projeto alheio/inexistente → fallback p/ o mais antigo", () =>
    expect(pickSelectedProject(projects, "zzz")).toEqual({ id: "p1", name: "Alpha" }));
  it("sem cookie → fallback p/ o mais antigo", () =>
    expect(pickSelectedProject(projects, null)).toEqual({ id: "p1", name: "Alpha" }));
  it("sem projetos → null", () =>
    expect(pickSelectedProject([], "p1")).toBeNull());
});
```

### `tests/integration/events-sync.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { ghBranch, ghCommit, ghRun, makeStubClient } from "../setup/github";

async function seedProject() {
  const owner = await db.user.create({
    data: { email: "owner@x.com", passwordHash: "x", role: "admin" },
  });
  return db.project.create({
    data: { userId: owner.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" },
  });
}

it("1º sync emite 1 evento por commit + 1 por run concluída", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main",
    commits: [ghCommit("a1", "feat: um"), ghCommit("a2", "fix: dois"), ghCommit("a3", "chore: tres")],
    branches: [ghBranch("main", "a1")],
    runs: [ghRun(1), ghRun(2)],
  }));
  const events = await db.event.findMany({ where: { projectId: project.id }, orderBy: { id: "asc" } });
  expect(events.filter((e) => e.type === "commit.created")).toHaveLength(3);
  expect(events.filter((e) => e.type === "ci.run")).toHaveLength(2);
  const c1 = events.find((e) => e.refId === "a1");
  expect(c1?.title).toBe("feat: um");
  expect(c1?.detail).toBe("Ana · mirantes.live");
  expect(c1?.createdAt).toEqual(new Date("2026-06-10T12:00:00Z")); // = committedAt
});

it("re-sync idêntico não reemite eventos", async () => {
  const project = await seedProject();
  const client = makeStubClient({
    defaultBranch: "main", commits: [ghCommit("a1"), ghCommit("a2")],
    branches: [ghBranch("main", "a1")], runs: [ghRun(1)],
  });
  await syncProject(project.id, client);
  await syncProject(project.id, client);
  expect(await db.event.count({ where: { projectId: project.id } })).toBe(3); // 2 commit + 1 ci
});

it("run só vira evento na transição p/ completed", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main")],
    runs: [ghRun(9, { status: "in_progress", conclusion: null })],
  }));
  expect(await db.event.count({ where: { type: "ci.run" } })).toBe(0);
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [], branches: [ghBranch("main")],
    runs: [ghRun(9, { status: "completed", conclusion: "success" })],
  }));
  const ci = await db.event.findMany({ where: { type: "ci.run" } });
  expect(ci).toHaveLength(1);
  expect(ci[0]?.title).toBe("CI CI #9: sucesso");
});

it("2º sync com 1 commit novo emite exatamente 1 commit.created", async () => {
  const project = await seedProject();
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [ghCommit("a1"), ghCommit("a2")],
    branches: [ghBranch("main", "a1")], runs: [],
  }));
  await syncProject(project.id, makeStubClient({
    defaultBranch: "main", commits: [ghCommit("a3"), ghCommit("a1"), ghCommit("a2")],
    branches: [ghBranch("main", "a3")], runs: [],
  }));
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(3);
});
```

### `tests/integration/events-list.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { listEvents } from "@/lib/events";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function event(projectId: string | null, over: Partial<{ title: string; visibleToClient: boolean; type: string }> = {}) {
  return db.event.create({
    data: {
      source: "commit", type: over.type ?? "commit.created", projectId,
      title: over.title ?? "t", visibleToClient: over.visibleToClient ?? true,
    },
  });
}

it("cliente vê só eventos do seu projeto (ou globais) e visíveis; admin vê tudo", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const b = await seedUser({ email: "b@x.com", password: "p", role: "client" });
  const pa = await createProject({ userId: a.id, name: "A", owner: "o", repo: "a" });
  const pb = await createProject({ userId: b.id, name: "B", owner: "o", repo: "b" });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await event(pa.project.id, { title: "do A" });
  await event(pb.project.id, { title: "do B" });
  await event(null, { title: "global" });

  const cliA = (await listEvents(asClient(a.id))).events.map((e) => e.title);
  expect(cliA).toContain("do A");
  expect(cliA).toContain("global");
  expect(cliA).not.toContain("do B");
  expect((await listEvents(ADMIN)).events).toHaveLength(3);
});

it("evento invisível some p/ cliente e aparece p/ admin", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "client" });
  const pa = await createProject({ userId: a.id, name: "A", owner: "o", repo: "a" });
  if (!pa.ok) throw new Error("setup");
  await event(pa.project.id, { title: "secreto", visibleToClient: false });
  expect((await listEvents(asClient(a.id))).events).toHaveLength(0);
  expect((await listEvents(ADMIN)).events.map((e) => e.title)).toEqual(["secreto"]);
});

it("filtra por projeto e ordena id desc", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p1 = await createProject({ userId: a.id, name: "P1", owner: "o", repo: "p1" });
  const p2 = await createProject({ userId: a.id, name: "P2", owner: "o", repo: "p2" });
  if (!p1.ok || !p2.ok) throw new Error("setup");
  await event(p1.project.id, { title: "p1-velho" });
  await event(p1.project.id, { title: "p1-novo" });
  await event(p2.project.id, { title: "p2" });
  const got = await listEvents(ADMIN, { projectId: p1.project.id });
  expect(got.events.map((e) => e.title)).toEqual(["p1-novo", "p1-velho"]); // id desc
});

it("paginação por cursor", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({ userId: a.id, name: "P", owner: "o", repo: "p" });
  if (!p.ok) throw new Error("setup");
  for (let i = 1; i <= 3; i++) await event(p.project.id, { title: `e${i}` });
  const page1 = await listEvents(ADMIN, { limit: 2 });
  expect(page1.events.map((e) => e.title)).toEqual(["e3", "e2"]);
  expect(page1.nextCursor).not.toBeNull();
  const page2 = await listEvents(ADMIN, { limit: 2, cursor: page1.nextCursor ?? undefined });
  expect(page2.events.map((e) => e.title)).toEqual(["e1"]);
  expect(page2.nextCursor).toBeNull();
});

it("serializa id (bigint) e createdAt como string", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({ userId: a.id, name: "P", owner: "o", repo: "p" });
  if (!p.ok) throw new Error("setup");
  await event(p.project.id, { title: "x" });
  const [ev] = (await listEvents(ADMIN)).events;
  expect(typeof ev?.id).toBe("string");
  expect(typeof ev?.createdAt).toBe("string");
});
```

### `tests/e2e/seed-events.ts` (NOVO — 2º projeto do admin + backfill)
```ts
import { backfillEvents } from "@/lib/events/backfill";
import { db } from "@/lib/db";

// Pré-seed determinístico p/ a jornada da Timeline (spec 012). Idempotente.
// 1) Garante um 2º projeto do admin (com commit distinto) p/ a troca de projeto no header.
// 2) Backfilla os eventos dos commits/runs já semeados (seed-activity) → timeline não vazia.
async function main() {
  const admin = await db.user.findFirstOrThrow({ where: { email: "admin@mirantes.live" } });
  const second = await db.project.upsert({
    where: { userId_owner_repo: { userId: admin.id, owner: "devlucasemiliano", repo: "segundo-repo" } },
    update: {},
    create: { userId: admin.id, name: "Segundo Repo", owner: "devlucasemiliano", repo: "segundo-repo" },
  });
  await db.commit.upsert({
    where: { projectId_sha: { projectId: second.id, sha: "seg00001" } },
    update: {},
    create: { projectId: second.id, sha: "seg00001", message: "feat: commit do segundo projeto",
      author: "Carla", committedAt: new Date("2026-06-12T10:00:00Z") },
  });
  const res = await backfillEvents();
  console.log(`[e2e-seed] eventos backfillados: ${res.commits} commits, ${res.runs} runs.`);
}

main()
  .catch((error) => { console.error("[e2e-seed-events] falhou:", error); process.exitCode = 1; })
  .finally(async () => { await db.$disconnect(); });
```

### `tests/e2e/timeline.spec.ts`
```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("timeline mostra commits e CI reais do projeto", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();
  await expect(page.getByText(/CI .*#1: sucesso/i)).toBeVisible();
});

test("trocar de projeto no header filtra o feed", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();

  await page.getByTestId("project-switcher").click();
  await page.getByTestId("project-option").filter({ hasText: "Segundo Repo" }).click();

  await expect(page.getByText("feat: commit do segundo projeto")).toBeVisible();
  await expect(page.getByText("feat: pré-seed e2e")).toHaveCount(0);
});

test("dashboard sem card 'último commit' e com Atividade Recente real", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Último commit sincronizado")).toHaveCount(0);
  await expect(page.getByText("Atividade Recente")).toBeVisible();
  await expect(page.getByText("feat: pré-seed e2e")).toBeVisible();
});

test("cliente não vê na timeline os commits do projeto do admin", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/timeline");
  await expect(page.getByText("feat: pré-seed e2e")).toHaveCount(0);
});
```

### `tests/e2e/global-setup.ts` (alterar — acrescentar)
```ts
  // Eventos da timeline (spec 012): 2º projeto do admin + backfill dos commits/runs semeados.
  execSync("bun run tests/e2e/seed-events.ts", { stdio: "inherit", env });
```

---

## Ordem de build (respeita §5.5)

1. Estender `truncateAll` (`events`) — harness verde.
2. **Schema** `Event` + `bunx prisma migrate dev --name events_timeline` + `bunx prisma generate`.
3. `src/lib/events/emit.ts` + `format.ts` e `src/lib/projects/select.ts` (`pickSelectedProject`) →
   **unit** (vermelho→verde).
4. Emissão em `sync.ts` + `src/lib/events.ts` + `src/lib/events/backfill.ts` → **integração**
   (vermelho→verde). Validar 1× quebrando a dedupe de emissão.
5. `GET /api/events` (handler + zod) e `selectProject`/`resolveSelectedProject`.
6. UI: `types.ts`; `app-header` + `project-switcher` (dropdown); `timeline-view`/`timeline-feed`
   (formatação real); `timeline/page` + `dashboard/page` (listEvents + remover card "último commit");
   `weeklyCommitStats`/`latestCommit` com `projectId`.
7. **E2E** `seed-events.ts` + `timeline.spec.ts` (vermelho→verde).
8. Fechamento: `.docs/SPEC.MD` (§2.4/§2.8/§4/§7) + `.docs/PRD.md` (§6/seletor); todos os DOC.md;
   `bunx biome check` + `bun run typecheck`; `status: done`.

## Critérios de pronto

- `Event` + migração; SPEC §2.4 ganha `project_id` e os `type` (`commit.created`/`ci.run`); §7 marca a
  emissão como feita (PUBLISH ainda 014); PRD §6 + seletor documentados.
- `syncProject` emite **1 evento/commit novo** + **`ci.run` ao concluir**, idempotente; `backfillEvents`
  preenche o histórico.
- `GET /api/events` + `listEvents` escopados (cliente só visível/próprio; admin tudo), filtro por
  projeto e cursor.
- Seletor troca o projeto (cookie) e **filtra** dashboard + timeline; fallback = mais antigo.
- Dashboard **sem** card "último commit"; Atividade Recente e Timeline **reais**.
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres/Redis reais, GitHub
  stubado (§5.3); sem mocks proibidos.
- `bunx biome check` + `bun run typecheck` limpos; sem import morto (`mockEvents`/`latestCommit` no
  dashboard, `relativeTime`).
- DOC.md criados/atualizados; spec `012` **`done`**.

## Verificação

- `bun run test:all` verde (Playwright com `next dev` **parado** — ver memória do projeto). Rodar 1×
  quebrando a dedupe de emissão de propósito (anti-"teste de mentira" §5.4).
- Manual: `bun run db:seed` → conectar o GitHub e sincronizar um projeto (Integrações) → Timeline lista
  os commits e o status de CI; trocar o projeto no header filtra o feed; `/dashboard` sem o card
  "último commit", com Atividade Recente real.

---

## Divergências da implementação (registro vivo — CLAUDE.md §3.2)

1. **Home pública real (decisão deste chat).** Maior divergência — registrada em detalhe acima
   ("Decisão #5" + "Divergência aprovada — Home pública lê eventos reais"): `listShowcaseEvents`,
   `src/app/page.tsx` real, `mockEvents` removido, testes `events-showcase`/`home.spec`.
2. **`EventDTO` = `TimelineEvent`.** O plano citava os dois nomes; unifiquei num único shape
   (`TimelineEvent`: `id` string, `createdAt` ISO). `listEvents`/`listShowcaseEvents` devolvem `TimelineEvent`.
3. **Server Action em arquivo dedicado.** O plano punha `selectProject` + `pickSelectedProject` +
   `resolveSelectedProject` em `select.ts`. Como um arquivo `"use server"` no topo não pode exportar
   função pura, `selectProject` foi p/ **`src/lib/projects/actions.ts`** (`"use server"`, padrão Next
   p/ ações importadas por Client Components). `select.ts` ficou com `pickSelectedProject` (puro) +
   `resolveSelectedProject` (imports **dinâmicos** de `next/headers`/`@/lib/projects` p/ manter o
   grafo do teste unit puro).
4. **`weeklyEventStats` (novo, em `events.ts`).** O "RESUMO DA SEMANA" da timeline passou a derivar de
   contagens reais 7d (commits/CI/total) — o plano só dizia "derivar de events (contagens 7d)". Coberto
   por `tests/integration/events-weekly.test.ts` (vermelho→verde).
5. **Testes além do desenho original.** Acrescentei `events-showcase.test.ts`, `events-backfill.test.ts`
   e `events-weekly.test.ts` (rigor §5.4 p/ vitrine, backfill idempotente e contagens 7d) e `home.spec.ts`.
6. **`backfillEvents` dedupe por `(projectId, refId)`** (não só `type+refId`) — evita colisão de sha entre
   projetos diferentes. Reusa `runToEvent` adaptando a linha do banco à forma `GhWorkflowRun`.
7. **`TimelineView`: `nowIso` (prop) + `key={projectId}`.** `now` vem do servidor (agrupamento Hoje/Ontem
   determinístico) e o `key` remonta a view ao trocar de projeto (reseta o estado do "carregar mais").
8. **Cookie `selected_project_id`: `httpOnly:true`, sem `secure`.** Sem `secure` p/ o cookie funcionar no
   e2e (http://localhost). Lido só no servidor → `httpOnly` ok.
9. **`public-header.tsx` (fora da lista do plano).** Usava o antigo `ProjectSwitcher` estático; como o
   switcher virou dropdown autenticado, a home anônima passou a um **chip estático** de nome do projeto.
10. **Ordem de build.** Schema+migração ANTES de estender `truncateAll` (o `TRUNCATE "events"` exige a
    tabela existir) — o plano listava `truncateAll` como passo 1.
