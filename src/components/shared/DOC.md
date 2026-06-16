# src/components/shared

## Propósito
Componentes de apresentação transversais, reutilizados em mais de uma tela (Visão Geral,
Home, Monitoramento). Renderizam blocos do design a partir de props/mock; sem estado de
domínio.

## Estrutura
Componentes avulsos, de apresentação (Server Components por padrão; nenhum usa `"use client"`).

## Arquivos
- **`stat-card.tsx`** — `StatCard({ title, className, children })`: card branco (raio 4px)
  com título Funnel Sans; o conteúdo (valor, ring, barra) vem dos filhos. Usado nos cards
  de Visão Geral e Monitoramento.
- **`status-badge.tsx`** — `StatusBadge({ status, overdue?, className })`: ponto colorido +
  rótulo do status da meta (`GOAL_STATUS_LABELS` de `@/lib/types`). `overdue` sobrepõe cor e
  rótulo para "Atrasada" (PRD §4.5).
- **`progress-ring.tsx`** — `ProgressRing({ value, size?, strokeWidth?, color?, label? })`:
  anel de progresso em **SVG puro** (sem lib de gráfico — fora da stack §0). Usado em
  "Progresso Total", "Saúde do Projeto", "Uptime".
- **`goals-list.tsx`** — `GoalsList({ goals, title? })`: seção "Metas do Projeto" **estática**
  (grupos pai + filhos via `GoalRow`). A versão interativa (expandir/selecionar) é
  `metas/metas-view.tsx`.
- **`timeline-feed.tsx`** — exporta `TimelineFeed` (card "Atividade Recente"),
  `TimelineEventRow` e o helper `eventVisual(event)` (ícone/cor por tipo/fonte de evento).
- **`uptime-panel.tsx`** — exporta `UptimePanel` (painel "Uptime do Projeto" da Home) e
  `UptimeDaysBar({ days, startLabel?, endLabel? })` (barra de 30 células de uptime diário),
  reutilizada na tela de Monitoramento. Lê `mockServices`/`mockIncidents`/`mockProjectUptimeDays`.

## O que NÃO vai aqui
- **Sem acesso a banco/Redis/segredos** e **sem regras de cálculo** (progresso/saúde/uptime
  são derivações que pertencem a `src/lib/*` nas specs reais).
- **Sem fetch de produto** — os valores vêm de props ou de `@/lib/mock-data`.
