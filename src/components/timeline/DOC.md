# src/components/timeline

## Propósito
Componente da tela **Timeline** (`/dashboard/timeline`): feed de eventos agrupado por dia
com painel lateral de busca, filtros por tipo, resumo da semana e metas mais ativas.

## Estrutura
Arquivo único cliente (`"use client"`) — a interação (busca/filtro) exige estado local.

## Arquivos
- **`timeline-view.tsx`** (`"use client"`) — `TimelineView({ events })`: **inclui os filtros**
  que a spec 002 nomeou como `timeline-filters` (consolidado aqui). Mantém estado local de
  `query` e `filter` (chips Todos/Concluído/Atualizado/Criado/Arquivado), filtra os eventos,
  agrupa por dia (`dateGroupOf`) e renderiza o feed + painel. Helpers internos: `feedVisual`
  (ícone/cor por tipo/fonte do evento), `timeOf`, `dateGroupOf`. Resumo da semana e
  "Metas mais ativas" são valores ilustrativos fixos.

## O que NÃO vai aqui
- **Sem SSE/realtime** — a Timeline ao vivo (assinar eventos via SSE/Redis Pub/Sub) depende
  da base de metas testada e vem na spec de SSE (CLAUDE.md §5.5, SPEC). Aqui o feed é o mock
  `mockEvents` filtrado client-side.
- **Sem banco/segredos** e **sem regra de negócio** de derivação de eventos.
