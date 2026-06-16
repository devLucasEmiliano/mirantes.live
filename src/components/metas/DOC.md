# src/components/metas

## Propósito
Componentes da área de **Metas**: linha de meta, árvore interativa, painel de detalhe e
formulário de nova meta. Renderizam o design e mantêm apenas **estado local** (mock) —
nenhuma mutação real ainda (virá na spec de CRUD de metas).

## Estrutura
- `metas-view` e `goal-form` são clientes (`"use client"`); `goal-row` e
  `goal-detail-panel` são de apresentação.

## Arquivos
- **`goal-row.tsx`** — `GoalRow({ goal, chevron?, showDue?, subdued?, className? })`: linha
  do design (chevron, título, `StatusBadge`, barra 80px, percentual mono). `subdued` =
  linha-filha indentada; `showDue` exibe a data prevista (helper `formatDue` interno).
- **`goal-detail-panel.tsx`** — `GoalDetailPanel({ goal, parentTitle?, onClose? })`: painel
  lateral 380px "Detalhes da Meta". **Somente exibição** — botões Salvar/Arquivar são
  visuais. Atividade recente é ilustrativa.
- **`goal-form.tsx`** (`"use client"`) — `GoalForm`: formulário "Criar Nova Meta". Mock —
  o submit só faz `router.push("/dashboard/metas")`; o select de Meta Pai lista `mockGoals`.
  A API real substituirá o `onSubmit`.
- **`metas-view.tsx`** (`"use client"`) — `MetasView({ goals })`: conteúdo interativo da
  página de Metas — busca (filtra grupos/filhos), grupos expansíveis (`collapsed: Set`),
  seleção de meta → `GoalDetailPanel`. **Equivale ao "goal-tree" citado na spec 002**
  (consolidado aqui). Estado 100% local.

## O que NÃO vai aqui
- **Sem mutação real / sem banco** — Salvar/Arquivar/Criar são visuais; a persistência
  pertence à spec de CRUD de metas (Postgres → evento → Redis → SSE, SPEC).
- **Sem regra de derivação de progresso/status do pai** — isso é cálculo de `src/lib/*`
  testado por unit; aqui os valores vêm prontos de `@/lib/mock-data`.
