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
  do nome (`deriveInitials`), além do nome e papel. Esconde "Configurações" se
  `role === "client"` (PRD §2) e tem botão **Sair** → `POST /api/auth/logout` → `/login`.
  Usa `usePathname` p/ destacar o item ativo. A `<aside>` é `sticky top-0 h-dvh`: fica
  presa na altura do viewport com o chip de perfil ancorado na base (via espaçador
  `flex-1`), sempre visível mesmo quando a `<main>` rola.
- **`public-header.tsx`** — cabeçalho da home `/`. Recebe o snapshot
  (`projectName`, `tagline`, `live`, `updatedAt`) e renderiza marca, selo AO VIVO
  (quando `live`) e o horário do snapshot. Passa `projectName` (do snapshot) ao `ProjectSwitcher`
  — a home é pública/sem sessão, então **não** consulta o banco.
- **`app-header.tsx`** (Server Component, `async`, spec 008) — cabeçalho interno (título +
  breadcrumb) das telas autenticadas. Busca o **nome do projeto raiz** (`db.project.findFirst`,
  `orderBy createdAt asc`, `select name`) e passa ao `ProjectSwitcher`.
- **`live-tag.tsx`** — selo "AO VIVO".
- **`project-switcher.tsx`** — exibe o **nome real** do projeto (prop `projectName`); sem projetos
  → "Nenhum projeto". Sem dropdown de troca de contexto ainda (spec futura).

## O que NÃO vai aqui
- **`sidebar.tsx` não importa o DAL `server-only`** — recebe o usuário já resolvido por
  prop (importar `session.ts` quebraria o bundle do cliente).
- **`project-switcher.tsx`/`sidebar.tsx` não acessam o banco** — recebem dados por prop (o
  `AppHeader`, que é Server Component, é quem consulta). O `app-header.tsx` é a exceção
  consciente: faz 1 query leve (só `name`) p/ alimentar o switcher.
- **Sem segredos** — nada de PAT/credenciais nestes componentes.
