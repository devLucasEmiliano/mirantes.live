---
id: 002
title: Páginas front-end (design Pencil → Next.js, mock data)
status: approved
test_levels: []
created: 2026-06-11
---

# 002 — Páginas front-end do GuiaGoals

## Objetivo

Construir **somente o front-end** das 8 telas do design `desing.pen` com dados mock e interação leve client-side — sem banco, sem auth real, sem SSE, sem Route Handlers. Base visual para as features reais das próximas specs.

Nodes do design: `W0bBr` (Home), `MoUGA` (Login), `s4yLg` (Visão Geral), `dUhvy` (Metas), `Mrdmq` (Nova Meta), `F7HfnJ` (Timeline), `lgTKG` (Monitoramento), `TCjL1` (Configurações); componentes `P3FgpJ` (Goal Row) e `RfrOx` (Project Switcher).

## Decisões aprovadas

- Rotas: `/` (Home pública), `/login`, `/dashboard`, `/dashboard/metas`, `/dashboard/metas/nova`, `/dashboard/timeline`, `/dashboard/monitoramento`, `/dashboard/configuracoes`.
- Interação leve: navegação real, grupos de metas expansíveis, seleção de meta → painel de detalhe, filtros com estado local. Sem persistência.
- `test_levels: []` — UI estática sem lógica de negócio; testes (unit/integração/e2e) nascem nas specs das features reais (login, CRUD de metas, SSE). Sem passo vermelho nesta task.
- Sem `proxy.ts`/middleware nesta task (login é mock).

## Arquivos a criar/alterar

- `src/app/`: `layout.tsx` (fontes Inter/Funnel Sans/IBM Plex Mono/Geist, `lang="pt-BR"`, metadata), `globals.css` (@theme com tokens do design + override das vars shadcn), `page.tsx` (Home), `login/page.tsx`, `dashboard/{layout,page}.tsx`, `dashboard/metas/{page,nova/page}.tsx`, `dashboard/{timeline,monitoramento,configuracoes}/page.tsx`.
- `src/components/`: `ui/` (shadcn), `layout/` (sidebar, app-header, public-header, project-switcher, live-tag), `shared/` (stat-card, status-badge, progress-ring, goals-list, timeline-feed, uptime-panel), `metas/` (goal-row, goal-tree, goal-detail-panel, goal-form), `timeline/` (timeline-filters), `monitoramento/` (service-row, incident-item, uptime-bars), `configuracoes/` (profile-card, password-card, tools-column).
- `src/lib/`: `utils.ts` (shadcn), `types.ts` (Goal, TimelineEvent, Service, Incident — espelham SPEC §2), `mock-data.ts`.
- `DOC.md` em cada pasta de `src/` (recursivo).
- Dependências: shadcn/ui (componentes base), lucide-react, fontes Google.

## Tokens do design (de `desing.pen`)

surface-primary `#E8E9EB` · surface-card `#FFFFFF` · surface-elevated `#F5F5F6` · surface-inverse `#1A1A1A` · accent-primary `#8F5A3C` · accent-secondary `#C2956A` · accent-tertiary `#A38979` · status-done `#4A7A5B` · status-in-progress `#C2956A` · status-overdue `#B54A4A` · status-todo `#999999` · foreground-primary `#1A1A1A` · foreground-muted `#999999` · foreground-inverse `#FFFFFF` · border-subtle `#E0E0E0` · rounded-sm 4px.

Fontes: Funnel Sans (títulos), Geist (UI), Inter (corpo), IBM Plex Mono (números — weight explícito 400/500/600).

## Mudanças de schema

Nenhuma (sem banco nesta task).

## Impacto em PRD/SPEC e DOC.md

- Não contradiz PRD/SPEC: implementa a camada visual das telas do PRD §1 ("Telas (menu)") com as rotas previstas (`/dashboard/**`).
- DOC.md: criados para todas as pastas novas de `src/` nesta mesma task.

## Desenho dos testes

`test_levels: []` — decisão registrada: nenhum teste nesta task. Justificativa (§5.2 do CLAUDE.md, cobertura proporcional): páginas estáticas com mock data, sem regra de cálculo nem fluxo. Os testes reais (unit de derivação de progresso, integração de Route Handlers, e2e de login/dashboard) pertencem às specs das features que introduzirão essas lógicas e infra (Vitest/Playwright/Testcontainers ainda não instalados — entram nessas specs).

## Critérios de pronto

- 8 rotas renderizando fiéis ao design (comparação com screenshots do Pencil).
- Navegação funcional (sidebar com item ativo, links entre páginas).
- Biome (lint+format) e `tsc --noEmit` sem erros.
- DOC.md de todas as pastas de `src/` criados/atualizados.
- Spec marcada `done`.
