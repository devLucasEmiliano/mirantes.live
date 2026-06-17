# src/lib/events

## Propósito
Camada de **eventos da Timeline** (spec 012): mapeia commit/run do GitHub em entrada de
evento, formata datas p/ a UI e backfilla o histórico já presente no banco. Os mapeadores
e a formatação são **puros** (unit-testáveis); só o backfill toca o Postgres. A leitura
paginada/escopada da timeline mora em `../events.ts` (o arquivo), não aqui.

## Estrutura
Arquivos avulsos, sem subpastas. `emit.ts`/`format.ts`/`visual.ts` são puros (unit); `backfill.ts`
acessa o banco (integração/seed).

## Arquivos
- **`emit.ts`** — puro, unit-testável. Converte commit/run em **`EventInput`** (linha pronta
  p/ `createMany`, antes de tocar o banco) e decide quando o CI vira evento:
  - `commitToEvent(projectId, repo, c: MappedCommit)` → `commit.created` (ou `commit.merged`
    quando `c.isMerge` — ícone diferente na Timeline; `source:"commit"`, `refId: sha`,
    `title: subject`, `detail: "<autor> · <repo>"`, `visibleToClient:true`,
    `createdAt: committedAt` — o tempo do commit, não o da descoberta).
  - `runToEvent(projectId, run: GhWorkflowRun)` → `ci.run` (`refId: String(run.id)`,
    `title: "CI <name> #<run_number>: <label>"`, `detail: "branch <head_branch>"`,
    `createdAt: new Date(run.updated_at)`).
  - `shouldEmitRunEvent(prev, incoming)` → `true` só na **transição p/ `completed`** (incoming
    concluído E prev inexistente ou ainda não-`completed`); re-sync de run já `completed` →
    `false` (idempotência por estado).
  - `runConclusionLabel(run)` → rótulo pt-BR (`sucesso`/`falhou`/`cancelado`/`concluído`) via
    `deriveRunStatus` de `github/map`.
  - Exporta a interface `EventInput`. Depende só de `import type` de `github/client` e de
    `github/map` (apagados em runtime) — sem I/O.
- **`format.ts`** — puro, unit-testável. Formatação de datas em horário **local**, com `now`
  como **parâmetro** (sem relógio escondido → estável em qualquer fuso):
  - `eventTime(date)` → `"14:32"` (HH:MM 24h, zero à esquerda).
  - `eventDateGroup(date, now)` → cabeçalho do grupo do dia: `"Hoje — 11 Jun 2026"` /
    `"Ontem — 10 Jun 2026"` / `"3 Jun 2026"` (mais antigo, sem prefixo; dia **sem** zero à
    esquerda, casando o design). `MONTHS_PT` interno. Sem dependências externas.
- **`visual.ts`** — puro, unit-testável. `eventVisualKind(event)` → categoria visual decidida pelo
  **`type`** (`merge`/`commit`/`ci`/`goal-*`/`incident-*`/`generic`), **não** pelo `source` — commit
  e CI compartilham `source:"commit"` e antes colidiam no mesmo ícone. O componente
  `components/shared/event-visual` mapeia a categoria → {ícone lucide, cor}. Exporta
  `EventVisualKind`. Sem lucide/JSX aqui (só a regra; os pixels ficam no componente).
- **`backfill.ts`** — `backfillEvents(): Promise<{ commits; runs }>` — **idempotente**: cria
  `commit.created`/`commit.merged` (o `type` sai de `Commit.isMerge`) p/ cada commit sem evento e
  `ci.run` p/ cada run `completed` sem evento, dedupe por **(projectId, refId)** cobrindo os **dois**
  tipos de commit (carrega os eventos existentes num `Set`). Reusa
  `commitToEvent`/`runToEvent` (adaptando a linha do `WorkflowRun` à forma `GhWorkflowRun`),
  insere em **ordem ascendente de tempo** (`createdAt`) p/ ids cronológicos (âncora do SSE,
  spec 014). Rodado pelo seed e2e (`tests/e2e/seed-events.ts`) e, em dev, direto via
  **`bun run db:backfill`** (guard `import.meta.main` no fim do arquivo) — preenche a Timeline
  com o histórico já sincronizado *antes* da spec 012 (commits novos passam a emitir no sync).
  Depende de `@/lib/db` e `./emit`.

## O que NÃO vai aqui
- **`emit.ts`/`format.ts` são puros** — sem I/O, sem Prisma, sem `next/*`. O `createMany`
  dos eventos vive no `sync.ts` (incremental) e no `backfill.ts` (histórico).
- **Sem UI/JSX** — só lógica de servidor e tipos. A formatação é consumida pelos componentes
  (`timeline-view`/`timeline-feed`), mas mora aqui por ser pura.
- **Sem PUBLISH/SSE** — emitir no Redis (`PUBLISH goals:updates`) + o stream é a **spec 014**;
  aqui os eventos só são gravados no Postgres.
- **Sem leitura paginada** — `listEvents`/`listShowcaseEvents`/`weeklyEventStats` ficam em
  `src/lib/events.ts` (o arquivo).
