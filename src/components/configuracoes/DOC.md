# src/components/configuracoes

## Propósito
Cards da tela `/dashboard/configuracoes`. Perfil e Senha são **funcionais** (spec 007). As
ferramentas da coluna direita (relatórios, uptime, toggles, zona de perigo) seguem visuais/mock.
A gestão de projetos (`ProjectsManager`) **saiu daqui** na spec 009 → vive em
`@/components/integracoes`.

## Estrutura
Consumidos por `src/app/dashboard/configuracoes/page.tsx`: coluna esquerda (conta) e coluna
direita (ferramentas). `profile-cards.tsx` é compartilhado (reusado também pelos cards de
Integrações).

## Arquivos
- **`profile-form.tsx`** (`"use client"`) — `ProfileForm`: edita **nome, email e foto**. Recebe os
  dados iniciais por props (o Server Component os busca). Nome/email → `PATCH /api/account/profile`;
  foto → `PUT`/`DELETE /api/account/avatar` (preview via `<img>` da rota GET, ou iniciais reais de
  `deriveInitials`). Trata 200/400/401/409 e dá `router.refresh()`. Espelha `login-form`.
- **`password-form.tsx`** (`"use client"`) — `PasswordForm`: liga ao `POST /api/auth/password`.
  Valida "nova == confirmar" no client **antes** do request; avisa que as outras sessões caem.
- **`profile-cards.tsx`** (compartilhado, **sem** `"use client"`) — presentacionais: `CardShell`,
  `ReadOnlyField` (exportados). Reusados pelos forms desta pasta **e** pelos cards de
  `@/components/integracoes` (`GithubConnectionCard`/`ProjectsManager`). Não hospeda mais o antigo
  `ProjectCard` (removido na spec 008).
- **`tools-cards.tsx`** (server) — coluna direita: `ReportsCard`, `UptimeMonitoringCard`,
  `ProjectSettingsCard`, `DangerZoneCard`. Ainda **sem handler** (mock).
- **`toggle.tsx`** (`"use client"`) — `Toggle`: switch acessível, sem persistência (mock).

## O que NÃO vai aqui
- **`ProjectsManager`** — foi movido para `@/components/integracoes/projects-manager`.
- **Sem acesso a banco/Prisma** — os forms falam com a API via `fetch`; o Server Component
  (`page.tsx`) é quem busca os dados iniciais na DAL.
- **Sem checagem de autorização** — o gate (`requireAdmin`) é da página, não dos componentes.
- **Sem regra de negócio de credenciais** — mora nos serviços de `src/lib/account/*` e nos Route
  Handlers; aqui só estado de UI + fetch.
- **Sem segredos no cliente.**
