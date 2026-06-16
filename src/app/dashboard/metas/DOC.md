# src/app/dashboard/metas

## Propósito
Rota autenticada `/dashboard/metas` — lista/árvore de metas do projeto. Subrota `nova/`
para o formulário de criação.

## Estrutura
- `page.tsx` — a tela de Metas.
- `nova/` — formulário "Criar Nova Meta" (ver `nova/DOC.md`).

## Arquivos
- **`page.tsx`** — `MetasPage` (Server Component). Define `metadata.title`
  ("Metas — Mirantes.Live"), renderiza o `AppHeader` (título + breadcrumb) e o
  `@/components/metas/metas-view` (`MetasView`), passando `mockGoals` (de `@/lib/mock-data`).
  A interatividade (busca, expandir grupos, selecionar meta → painel de detalhe) está no
  `MetasView` (cliente) — ver `src/components/metas/DOC.md`.

## O que NÃO vai aqui
- **Sem fetch real de metas** — dados ainda são `mockGoals`; o carregamento via DAL/banco e
  o CRUD pertencem à spec de Metas.
- **Sem acesso direto ao banco na página** — usar libs de `src/lib/*` quando a feature real
  chegar. A guarda de sessão é do `dashboard/layout.tsx`.
