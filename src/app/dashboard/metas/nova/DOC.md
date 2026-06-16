# src/app/dashboard/metas/nova

## Propósito
Rota autenticada `/dashboard/metas/nova` — formulário de criação de meta.

## Estrutura
Página única que monta o cabeçalho e o formulário.

## Arquivos
- **`page.tsx`** — `NovaMetaPage` (Server Component). Define `metadata.title`
  ("Nova Meta — Mirantes.Live"), renderiza o `AppHeader` (breadcrumb
  "Dashboard / Metas / Nova Meta") e o `@/components/metas/goal-form` (`GoalForm`, cliente).
  O `GoalForm` é **mock**: o submit apenas volta para `/dashboard/metas` — ver
  `src/components/metas/DOC.md`.

## O que NÃO vai aqui
- **Sem persistência** — não há `POST` de meta; a criação real (validação zod, transação,
  evento, Pub/Sub) pertence à spec de CRUD de metas.
- **Sem acesso a banco/segredos na página.**
