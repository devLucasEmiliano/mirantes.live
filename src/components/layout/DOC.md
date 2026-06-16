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
  (quando `live`) e o horário do snapshot.
- **`app-header.tsx`** — cabeçalho interno (título + breadcrumb) das telas autenticadas.
- **`live-tag.tsx`** — selo "AO VIVO".
- **`project-switcher.tsx`** — seletor de projeto (mock).

## O que NÃO vai aqui
- **`sidebar.tsx` não importa o DAL `server-only`** — recebe o usuário já resolvido por
  prop (importar `session.ts` quebraria o bundle do cliente).
- **Sem acesso a banco/segredos** — componentes de layout são apresentação.
