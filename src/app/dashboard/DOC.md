# src/app/dashboard

## Propósito
Área autenticada do app. O `layout.tsx` é o shell (sidebar + main) **e** o portão de sessão;
as páginas/subrotas são as telas do produto. Só acessível com sessão válida (proxy + DAL).

## Estrutura
- `layout.tsx` — shell + guarda de sessão (DAL).
- `page.tsx` — Visão Geral (cards + atividade + uptime; ainda mock).
- `metas/`, `timeline/`, `monitoramento/` — telas do produto (mock por enquanto).
- `configuracoes/` — área exclusiva do admin. Ver `configuracoes/DOC.md`.

## Arquivos
- **`layout.tsx`** (Server Component, `async`) — resolve o usuário via `getCurrentUser()`
  (DAL, verificação real no banco); sem sessão → `redirect('/login')`. Faz uma query leve
  extra (`name` + `avatar.updatedAt`, **sem** o blob) e passa `{email, role, name, hasAvatar,
  avatarVersion}` ao `Sidebar` p/ o chip de perfil. O `proxy.ts` faz só o gate ótimista por
  assinatura — a checagem autoritativa é aqui.
- **`page.tsx`** (Server Component, `async`) — Visão Geral. **Reais (spec 008):** card "Commits da
  Semana" (`weeklyCommitStats()` + `formatWeeklyDelta`) e bloco "último commit sincronizado"
  (`latestCommit()`, acima do `TimelineFeed`). O bloco mostra sha/mensagem/autor/tempo — **não** o
  nome do projeto (evita colidir com o switcher no header). Metas/saúde/uptime seguem mock
  (`@/lib/mock-data`).

## O que NÃO vai aqui
- **Sem checagem de papel "solta" no layout** — o gating por papel mora no DAL
  (`requireAdmin`) e na página sensível (`configuracoes`); o layout só exige sessão.
- **Sem setar cookie** (é Server Component) — login/logout vivem em `api/auth/*`.
- **Sem acesso direto ao banco nas páginas** — usar o DAL e libs de `src/lib/*`.
