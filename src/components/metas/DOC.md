# src/components/metas

## Propósito
Componentes da área de **Metas** (spec 013): árvore recursiva, linha de meta, painel de detalhe
e formulário de criação. Consomem metas **reais** (`Goal` de `@/lib/types`, vindas de
`goals/service` via `toGoalDTO`) e fazem mutações via `fetch` na API `/api/goals*`.

## Estrutura
- `metas-view` e `goal-form` são clientes (`"use client"`); `goal-row` e `goal-detail-panel`
  são de apresentação.

## Arquivos
- **`goal-row.tsx`** — `GoalRow({ goal, chevron?, showDue?, subdued?, compact?, className? })`:
  linha do design + **short code** (`M-N`) e, em meta medível, o `current/target` (X→Y).
  Barra/percentual usam `goal.percent ?? goal.progress`. **`compact`** (spec 014) oculta o badge
  X→Y e a barra de progresso (mantém status + percentual) — usado no preview estreito da Visão
  Geral (`GoalsList`); **off por padrão**, então a página de Metas renderiza igual.
- **`goal-detail-panel.tsx`** — `GoalDetailPanel({ goal, parentTitle?, canMutate?, onClose?,
  onArchive?, onChangeStatus? })`: painel 380px. Mostra short code, X→Y, commits atribuídos.
  Admin (`canMutate`) edita status (folha; pai é derivado/read-only) e arquiva; cliente é
  read-only.
- **`goal-form.tsx`** (`"use client"`) — `GoalForm({ projectId, parents })`: formulário REAL —
  `useState` + `fetch('/api/goals', POST)` (sem react-hook-form). "Valor Alvo (Y)" preenchido →
  meta medível; `dueDate` tem default (hoje+30d). Em sucesso, `router.push` + `router.refresh`.
- **`metas-view.tsx`** (`"use client"`) — `MetasView({ goals, canMutate? })`: busca recursiva,
  árvore de **profundidade ilimitada** (`GoalTree`), seleção → `GoalDetailPanel`, arquivar/editar
  via `fetch` (`DELETE`/`PATCH`) + `router.refresh()`.

## O que NÃO vai aqui
- **Sem acesso direto ao banco / ao service** — a página (Server Component) carrega via
  `goals/service`; aqui só `fetch` na API.
- **Sem regra de derivação** (progresso/status do pai, X→Y) — isso é `@/lib/goals/derive` (puro,
  testado por unit); os valores chegam prontos no `Goal`.
- **Mutação só por admin** — `canMutate` esconde os controles para cliente (o servidor reforça).
