# src/app

## Propósito
Raiz do App Router (Next 16): rotas, layouts e Route Handlers. `/` é pública (home);
`/dashboard/**` é autenticada; `/login` é a entrada. O gate de rota vive em `src/proxy.ts`.

## Estrutura
- `page.tsx` — **home pública** `/`. `async` + `force-dynamic`; é o **gêmeo público e só-leitura
  do `/dashboard`** (spec 016): cards, metas e timeline **REAIS** do projeto público **selecionado**.
  Resolve a seleção com `pickPublicProject(projects, projeto, cookieId)` (URL `?projeto=` > cookie
  `public_project_id` > público mais antigo) sobre `listPublicProjects()`. `readHomeSnapshot()` do
  Redis ainda alimenta marca/tagline/live/updatedAt do `PublicHeader`. Só o `UptimePanel` segue mock.
- `layout.tsx` — layout raiz (html/body, fontes, estilos globais).
- `globals.css` — tokens de design e Tailwind.
- `login/` — `page.tsx` da tela de login (renderiza `LoginForm`).
- `dashboard/` — área autenticada. `layout.tsx` resolve o usuário via DAL
  (`getCurrentUser`; sem sessão → `/login`) e passa ao `Sidebar`; subrotas (metas,
  timeline, monitoramento, configuracoes). `configuracoes/page.tsx` exige `requireAdmin()`.
- `api/` — Route Handlers. Ver `api/DOC.md`.

## Arquivos (home pública real — spec 016)
- `page.tsx` — home como vitrine pública só-leitura, com os **mesmos 5 cards do `/dashboard`**
  (Progresso Total, Metas Concluídas, Em Andamento, Commits da Semana, Metas Atrasadas) sobre
  dados reais do projeto público selecionado: `listPublicGoals(id)` + `summarizeGoals` + `toGoalDTO`
  (cards/metas), `publicWeeklyCommitStats(id)` (Commits da Semana, com `formatWeeklyDelta`) e
  `listPublicEvents(id, 7)` (timeline). Seleção via `pickPublicProject` (URL > cookie
  `PUBLIC_PROJECT_COOKIE` > público mais antigo); o cookie é lido aqui (Server Component, só
  leitura). `listPublicProjects()` (embrulhado em `.catch(() => [])`) abastece o
  `PublicProjectSwitcher` embutido no `PublicHeader`. Sem projeto público → casca + **estado vazio**.
  `readHomeSnapshot()` do Redis alimenta marca/tagline/live/updatedAt do header. A casca (`Shell`)
  mantém fundo `PixelBlast` + `PublicHeader`, **sem sidebar**. Nada na `/` é editável por visitantes.
  Já **não** consome `mockGoals`/`mockSummary` (era o último consumidor real do mock).
- `dashboard/layout.tsx` — guarda de sessão + injeção do usuário no sidebar.
- `dashboard/configuracoes/page.tsx` — `await requireAdmin()` (cliente → `/dashboard`).

## O que NÃO vai aqui
- **Cookies não podem ser setados em Server Component** (page/layout) — só em Route
  Handler/Server Action/proxy. Login/logout vivem em `api/auth/*`.
- **Sem acesso direto ao banco em componentes** — usar o DAL (`src/lib/auth/session`)
  e libs de `src/lib/*`.
- Checagem de papel sensível não se apoia só no sidebar (UI); a rota protegida revalida
  no servidor (`requireAdmin`).
