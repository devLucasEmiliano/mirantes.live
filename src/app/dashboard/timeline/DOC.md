# src/app/dashboard/timeline

## Propósito
Rota autenticada `/dashboard/timeline` — histórico de atividades do projeto (eventos de
metas, commits, incidentes) agrupado por dia, com busca e filtros.

## Estrutura
Página única que monta o cabeçalho e o componente de feed.

## Arquivos
- **`page.tsx`** — `TimelinePage` (Server Component **`async`**, spec 012). Define
  `metadata.title` ("Timeline — Mirantes.Live"). Resolve `scope = scopeForUser(await
  requireUser())` + `selected = await resolveSelectedProject(scope)` (cookie; fallback = mais
  antigo) e busca, em paralelo, `listEvents(scope, { projectId, limit: 30 })` e
  `weeklyEventStats(scope, projectId)`. Renderiza o `AppHeader` e o `TimelineView`
  (`@/components/timeline/timeline-view`), passando `events`/`nextCursor`/`projectId`/`nowIso`
  (`new Date().toISOString()`, p/ agrupar Hoje/Ontem de forma determinística)/`weekSummary` — e
  com `key={projectId ?? "all"}` p/ **remontar** o feed ao trocar de projeto. Busca, filtros,
  agrupamento por dia e "Carregar mais" estão no `TimelineView` (cliente) — ver
  `src/components/timeline/DOC.md`.

## O que NÃO vai aqui
- **Sem SSE/realtime** — o feed é **real mas não ao vivo**: relê `events` do banco a cada
  carga/navegação. O stream (SSE + Redis Pub/Sub) vem na spec 014 (CLAUDE.md §5.5).
- **Sem `mockEvents`** — a Timeline lê eventos reais (`listEvents`); o mock foi removido.
- **Sem acesso direto ao banco na página** — usa as libs (`@/lib/events`, `projects/select`);
  a guarda de sessão é do `dashboard/layout.tsx`.
