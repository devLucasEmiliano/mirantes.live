# src/components/shared

## Propósito
Componentes de apresentação transversais, reutilizados em mais de uma tela (Visão Geral,
Home, Monitoramento). Renderizam blocos do design a partir de props/mock; sem estado de
domínio.

## Estrutura
Componentes avulsos, de apresentação (Server Components por padrão). A única exceção é
`pixel-blast.jsx`, um efeito de fundo WebGL que precisa de `"use client"`.

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
- **`pixel-blast.jsx`** — `default PixelBlast(props)`: fundo decorativo WebGL (efeito
  "PixelBlast" do React Bits, inspirado em zavalit/bayer-dithering-webgl-demo). Client
  Component (`"use client"`) que monta um `<canvas>` three.js + `postprocessing` no
  `useEffect` e o destrói no cleanup. Props principais: `variant` (square/circle/triangle/
  diamond), `pixelSize`, `color`, `patternScale`, `patternDensity`, `enableRipples`,
  `liquid`, `speed`, `edgeFade`, `transparent`. Usado como camada `-z-10` na Home (`app/page.tsx`).
  Vendorizado como `.jsx` de propósito (código de terceiros pesado em three.js, fora do TS estrito).

## O que NÃO vai aqui
- **Sem acesso a banco/Redis/segredos** e **sem regras de cálculo** (progresso/saúde/uptime
  são derivações que pertencem a `src/lib/*` nas specs reais).
- **Sem fetch de produto** — os valores vêm de props ou de `@/lib/mock-data`.
- `pixel-blast.jsx` é um efeito visual isolado: **sem lógica de domínio** dentro dele;
  ajuste a aparência apenas via props onde for usado.
