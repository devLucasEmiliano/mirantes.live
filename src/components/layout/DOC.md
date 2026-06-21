# src/components/layout

## Propósito
Componentes estruturais (chrome) das telas: sidebar autenticada, cabeçalhos público e
interno e seus acessórios.

## Estrutura
Componentes avulsos; `sidebar` é cliente, os demais são de apresentação.

## Arquivos
- **`sidebar.tsx`** (`"use client"`) — navegação do dashboard. Recebe `user` (DTO
  `{email, role, name, hasAvatar, avatarVersion}`) por prop do `dashboard/layout`. O chip
  inferior mostra a **foto** (`<img>` do `GET /api/account/avatar`) ou as **iniciais reais**
  do nome (`deriveInitials`), além do nome e papel. Inclui o item **"Integrações"** (ícone
  `Plug`, → `/dashboard/integracoes`), visível a admin **e** cliente. Esconde "Configurações"
  se `role === "client"` (PRD §2; só esse item tem `adminOnly`) e tem botão **Sair** →
  `POST /api/auth/logout` → `/login`.
  Usa `usePathname` p/ destacar o item ativo. A `<aside>` é `sticky top-0 h-dvh`: fica
  presa na altura do viewport com o chip de perfil ancorado na base (via espaçador
  `flex-1`), sempre visível mesmo quando a `<main>` rola.
- **`public-header.tsx`** — cabeçalho da home `/`. Recebe o snapshot
  (`projectName`, `tagline`, `live`, `updatedAt`) e renderiza marca, selo AO VIVO
  (quando `live`) e o horário do snapshot. Recebe também `projects` (`PublicSwitcherItem[]`) +
  `selectedId` (spec 016) e **embute** o `PublicProjectSwitcher` no lado direito — o seletor
  **substituiu** o antigo chip estático da vitrine. Continua **sem consultar o banco** (recebe
  tudo por prop).
- **`app-header.tsx`** (Server Component, `async`, spec 008/009/012) — cabeçalho interno (título +
  breadcrumb) das telas autenticadas. Resolve o usuário (`getCurrentUser`), lista os projetos do
  escopo (`listProjects(scope)`) e **resolve o selecionado** lendo o cookie
  (`SELECTED_PROJECT_COOKIE`) via `pickSelectedProject` (fallback = mais antigo). Passa
  `projects` (`{id,name}`) + `selectedId` ao `ProjectSwitcher`. Cliente vê só os seus; admin todos.
- **`public-project-switcher.tsx`** (`"use client"`, spec 016) — **dropdown** dos projetos
  PÚBLICOS da home `/` (de qualquer dono). Recebe `projects` (`PublicSwitcherItem[]`) + `selectedId`
  e exporta a `interface PublicSwitcherItem { id; name; slug }` (`slug` = `owner/repo`). Espelha o
  `project-switcher.tsx` (header logado), **mas** cada item é um `<Link href={"/?projeto=" +
  encodeURIComponent(slug)}>` — link **compartilhável** e a **fonte de verdade** da seleção (server
  re-render pelo searchParam). O clique também dispara a Server Action `selectPublicProject`
  (`@/lib/projects/public-actions`) gravando um **cookie de memória** (não-crítico). Fecha ao clicar
  fora; sem públicos → "Nenhum projeto público" (botão inerte). `data-testid`:
  `public-project-switcher` (gatilho) e `public-project-option` (itens).
- **`live-tag.tsx`** — selo "AO VIVO".
- **`project-switcher.tsx`** (`"use client"`, spec 012) — **dropdown** de troca de contexto.
  Recebe `projects` + `selectedId`; ao escolher, chama a Server Action `selectProject`
  (`@/lib/projects/actions`, grava o cookie) dentro de um `useTransition` e em seguida
  `router.refresh()` p/ o servidor re-renderizar dashboard/timeline filtrados. Fecha ao clicar
  fora; sem projetos → "Nenhum projeto" (botão inerte). `data-testid`: `project-switcher` (gatilho)
  e `project-option` (itens).

## O que NÃO vai aqui
- **`sidebar.tsx` não importa o DAL `server-only`** — recebe o usuário já resolvido por
  prop (importar `session.ts` quebraria o bundle do cliente).
- **`project-switcher.tsx`/`public-project-switcher.tsx`/`sidebar.tsx` não acessam o banco** —
  recebem dados por prop (o `AppHeader`/a page da home, Server Components, é quem consulta os
  projetos + resolve o selecionado). Os switchers só disparam as Server Actions `selectProject`/
  `selectPublicProject` (a escrita do cookie roda no servidor). Na home, a fonte de verdade da
  seleção é a URL `?projeto=` (`<Link>`); o cookie é só memória não-crítica.
- **Sem segredos** — nada de PAT/credenciais nestes componentes.
