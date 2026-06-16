# src/components

## Propósito
Todos os componentes de UI do app, organizados por domínio de tela. São a camada de
apresentação: recebem dados já resolvidos (props / mock) e renderizam o design do
`desing.pen`. Nenhuma busca de dados ou regra de negócio vive aqui.

## Estrutura
- `ui/` — primitivos shadcn/ui (button, card, input, …). Base reutilizável.
- `layout/` — chrome das telas: sidebar, cabeçalhos, project-switcher, live-tag.
- `login/` — formulário de login (cliente; chama `POST /api/auth/login`).
- `shared/` — componentes transversais usados em mais de uma tela (stat-card,
  status-badge, progress-ring, goals-list, timeline-feed, uptime-panel).
- `metas/` — componentes da área de Metas (goal-row, goal-detail-panel, goal-form,
  metas-view).
- `monitoramento/` — cards da tela de Monitoramento (service-cards).
- `timeline/` — feed e painel da tela Timeline (timeline-view).
- `configuracoes/` — cards da tela de Configurações (profile-cards, tools-cards, toggle).

Cada subpasta tem seu próprio `DOC.md` com os arquivos detalhados.

## Arquivos
Nenhum arquivo solto nesta raiz — tudo mora nas subpastas acima.

## O que NÃO vai aqui
- **Sem acesso a banco/Redis/segredos** — componentes não importam `src/lib/db`,
  `redis`, nem o DAL `server-only` (`src/lib/auth/session`). Dados chegam por prop.
- **Sem lógica de negócio** (derivação de progresso/saúde, regras de atraso) — isso
  pertence a `src/lib/*` e às specs de features reais. Aqui há só apresentação e
  interação leve client-side (filtros, expandir/recolher, seleção).
- **Sem fetch de dados de produto** — as telas atuais consomem `src/lib/mock-data`.
