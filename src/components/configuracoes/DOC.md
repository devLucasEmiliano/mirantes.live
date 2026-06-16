# src/components/configuracoes

## Propósito
Cards da tela `/dashboard/configuracoes`. Os dois primeiros (Perfil e Senha) são **funcionais**
(spec 007): editam dados reais do usuário logado. Os demais (Projetos, ferramentas da coluna
direita) ainda são visuais/mock e entram em specs próprias (008+).

## Estrutura
Consumidos por `src/app/dashboard/configuracoes/page.tsx`: coluna esquerda (conta/projetos) e
coluna direita (ferramentas).

## Arquivos
- **`profile-form.tsx`** (`"use client"`) — `ProfileForm`: edita **nome, email e foto**. Recebe os
  dados iniciais por props (o Server Component os busca). Nome/email → `PATCH /api/account/profile`;
  foto → `PUT`/`DELETE /api/account/avatar` (preview via `<img>` da rota GET, ou iniciais reais de
  `deriveInitials`). Trata 200/400/401/409 e dá `router.refresh()`. Espelha `login-form`.
- **`password-form.tsx`** (`"use client"`) — `PasswordForm`: liga ao `POST /api/auth/password`.
  Valida "nova == confirmar" no client **antes** do request; avisa que as outras sessões caem.
- **`profile-cards.tsx`** (compartilhado, **sem** `"use client"`) — presentacionais reusados pelos
  forms e por `ProjectCard`: `CardShell`, `ReadOnlyField` (exportados) + `ProjectCard` (projetos,
  ainda mock). Não usa mais `mockUser`.
- **`tools-cards.tsx`** (server) — coluna direita: `ReportsCard`, `UptimeMonitoringCard`,
  `ProjectSettingsCard`, `DangerZoneCard`. Ainda **sem handler** (mock).
- **`toggle.tsx`** (`"use client"`) — `Toggle`: switch acessível, sem persistência (mock).

## O que NÃO vai aqui
- **Sem acesso a banco/Prisma** — os forms falam com a API via `fetch`; o Server Component
  (`page.tsx`) é quem busca os dados iniciais na DAL.
- **Sem checagem de autorização** — o gate (`requireAdmin`) é da página, não dos componentes.
- **Sem regra de negócio de credenciais** — mora nos serviços de `src/lib/account/*` e nos Route
  Handlers; aqui só estado de UI + fetch.
- **Sem segredos no cliente.**
