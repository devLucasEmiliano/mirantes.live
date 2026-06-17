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
  (quando `live`) e o horário do snapshot. A home é **anônima** (projeto único da vitrine), então
  mostra um **chip estático** com o `projectName` (do snapshot) — **não** usa mais o
  `ProjectSwitcher` nem consulta o banco.
- **`app-header.tsx`** (Server Component, `async`, spec 008/009/012) — cabeçalho interno (título +
  breadcrumb) das telas autenticadas. Resolve o usuário (`getCurrentUser`), lista os projetos do
  escopo (`listProjects(scope)`) e **resolve o selecionado** lendo o cookie
  (`SELECTED_PROJECT_COOKIE`) via `pickSelectedProject` (fallback = mais antigo). Passa
  `projects` (`{id,name}`) + `selectedId` ao `ProjectSwitcher`. Cliente vê só os seus; admin todos.
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
- **`project-switcher.tsx`/`sidebar.tsx` não acessam o banco** — recebem dados por prop (o
  `AppHeader`, que é Server Component, é quem consulta `listProjects` + lê o cookie). O switcher
  só dispara a Server Action `selectProject` (a escrita do cookie roda no servidor).
- **Sem segredos** — nada de PAT/credenciais nestes componentes.
