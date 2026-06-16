# src/app

## Propósito
Raiz do App Router (Next 16): rotas, layouts e Route Handlers. `/` é pública (home);
`/dashboard/**` é autenticada; `/login` é a entrada. O gate de rota vive em `src/proxy.ts`.

## Estrutura
- `page.tsx` — **home pública** `/`. `async` + `force-dynamic`; lê `readHomeSnapshot()`
  do Redis e alimenta o `PublicHeader`. Cards/listas abaixo ainda são mock.
- `layout.tsx` — layout raiz (html/body, fontes, estilos globais).
- `globals.css` — tokens de design e Tailwind.
- `login/` — `page.tsx` da tela de login (renderiza `LoginForm`).
- `dashboard/` — área autenticada. `layout.tsx` resolve o usuário via DAL
  (`getCurrentUser`; sem sessão → `/login`) e passa ao `Sidebar`; subrotas (metas,
  timeline, monitoramento, configuracoes). `configuracoes/page.tsx` exige `requireAdmin()`.
- `api/` — Route Handlers. Ver `api/DOC.md`.

## Arquivos (auth — task 003)
- `page.tsx` — home servida do snapshot Redis (SPEC §1/§4).
- `dashboard/layout.tsx` — guarda de sessão + injeção do usuário no sidebar.
- `dashboard/configuracoes/page.tsx` — `await requireAdmin()` (cliente → `/dashboard`).

## O que NÃO vai aqui
- **Cookies não podem ser setados em Server Component** (page/layout) — só em Route
  Handler/Server Action/proxy. Login/logout vivem em `api/auth/*`.
- **Sem acesso direto ao banco em componentes** — usar o DAL (`src/lib/auth/session`)
  e libs de `src/lib/*`.
- Checagem de papel sensível não se apoia só no sidebar (UI); a rota protegida revalida
  no servidor (`requireAdmin`).
