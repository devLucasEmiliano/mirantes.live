# src/app/dashboard/metas

## Propósito
Rota autenticada `/dashboard/metas` — árvore de metas **reais** (spec 013) do escopo, filtrada
pelo projeto selecionado. Subrota `nova/` para o formulário de criação.

## Estrutura
- `page.tsx` — a tela de Metas.
- `nova/` — formulário "Criar Nova Meta" (ver `nova/DOC.md`).

## Arquivos
- **`page.tsx`** — `MetasPage` (Server Component, async). `requireUser()` → `scopeForUser` →
  `resolveSelectedProject(scope)` (cookie; fallback = mais antigo) → `listGoals(scope, projectId)`
  → `map(toGoalDTO)` → `MetasView`. Passa `canMutate = user.role === "admin"`. Sem mais
  `mockGoals`. Interatividade/mutações no `MetasView` (cliente).

## O que NÃO vai aqui
- **Sem `mockGoals`** — dados vêm de `@/lib/goals/service` (`listGoals`), escopados por papel.
- **Sem acesso direto ao Prisma na página** — só via o service (único portão Postgres das metas).
  A guarda de sessão base é do `dashboard/layout.tsx`; aqui `requireUser()` reforça e dá o escopo.
