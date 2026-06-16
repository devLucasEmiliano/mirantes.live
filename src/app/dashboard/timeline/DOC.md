# src/app/dashboard/timeline

## Propósito
Rota autenticada `/dashboard/timeline` — histórico de atividades do projeto (eventos de
metas, commits, incidentes) agrupado por dia, com busca e filtros.

## Estrutura
Página única que monta o cabeçalho e o componente de feed.

## Arquivos
- **`page.tsx`** — `TimelinePage` (Server Component). Define `metadata.title`
  ("Timeline — Mirantes.Live"), renderiza o `AppHeader` e o
  `@/components/timeline/timeline-view` (`TimelineView`), passando `mockEvents` (de
  `@/lib/mock-data`). Busca, filtros e agrupamento por dia estão no `TimelineView` (cliente)
  — ver `src/components/timeline/DOC.md`.

## O que NÃO vai aqui
- **Sem SSE/realtime** — o stream ao vivo de eventos (SSE + Redis Pub/Sub) depende da base
  de metas e vem na spec de SSE (CLAUDE.md §5.5). Aqui o feed é `mockEvents` filtrado
  client-side.
- **Sem acesso direto ao banco na página** — guarda de sessão é do `dashboard/layout.tsx`.
