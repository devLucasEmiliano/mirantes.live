# src/app/dashboard/metas/nova

## Propósito
Rota autenticada `/dashboard/metas/nova` — formulário de criação de meta.

## Estrutura
Página única que monta o cabeçalho e o formulário.

## Arquivos
- **`page.tsx`** — `NovaMetaPage` (Server Component, async, spec 013). `requireUser` →
  `scopeForUser` → `resolveSelectedProject` → `listGoals` (achatadas em opções de meta-pai). Passa
  `projectId` (do projeto selecionado) e `parents` ao `@/components/metas/goal-form` (`GoalForm`,
  cliente), que faz `POST /api/goals` real — ver `src/components/metas/DOC.md`.

## O que NÃO vai aqui
- **Sem `POST` direto na página** — a criação é feita pelo `GoalForm` (cliente) na API
  `/api/goals`; a página só carrega o contexto (projeto + metas-pai).
- **Sem acesso a banco/segredos no cliente** — o carregamento de metas-pai é no Server Component
  (via `goals/service`); o form só recebe os dados prontos.
