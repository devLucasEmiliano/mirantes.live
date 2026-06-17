# src/components/timeline

## Propósito
Componente da tela **Timeline** (`/dashboard/timeline`): feed real de eventos agrupado por dia
com painel lateral de busca, filtros por tipo e resumo da semana.

## Estrutura
Arquivo único cliente (`"use client"`) — a interação (busca/filtro/paginação) exige estado local.

## Arquivos
- **`timeline-view.tsx`** (`"use client"`, spec 012) — `TimelineView({ events, nextCursor,
  projectId?, nowIso, weekSummary })`: **inclui os filtros** que a spec 002 nomeou como
  `timeline-filters` (consolidado aqui). Mantém estado local de `query`, `filter` (chips
  Todos/Concluído/Atualizado/Criado/Arquivado), os eventos extras já paginados e o `cursor`
  atual. Agrupa por dia com `eventDateGroup` e exibe o horário com `eventTime` — ambos **reais**,
  de `@/lib/events/format` (recebe `nowIso` p/ agrupar Hoje/Ontem de forma determinística, sem
  data hardcoded). **"Carregar mais"** busca a próxima página via `GET /api/events?cursor=…`
  (propagando `projectId`). O painel **"RESUMO DA SEMANA"** mostra contagens reais de
  `weekSummary` (`commits`/`ci`/`total`). Ícone/cor de cada evento via `eventVisual` (compartilhado,
  `components/shared/event-visual`; commit ≠ merge ≠ CI por `type`).
  O painel **"METAS MAIS ATIVAS"** foi **ocultado** (sem mock; volta com metas reais na spec 013).
  A janela "PERÍODO" (De/Até) segue estática.

## O que NÃO vai aqui
- **Sem SSE/realtime** — o feed é real mas **não ao vivo**: vem por props da página (Server
  Component) e pagina por fetch pontual; o stream (SSE/Redis Pub/Sub) é a spec 014 (CLAUDE.md §5.5).
- **Sem `mockEvents`** — os eventos chegam por prop (reais); a formatação é a de `events/format`.
- **Sem banco/segredos** e **sem regra de negócio** de derivação de eventos (só apresentação +
  fetch de paginação no endpoint).
