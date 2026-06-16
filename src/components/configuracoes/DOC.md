# src/components/configuracoes

## Propósito
Cards da tela `/dashboard/configuracoes`. Perfil e Senha são **funcionais** (spec 007) e
**Projetos** também (spec 008: lista/adiciona/remove/sincroniza + log de atividade). As
ferramentas da coluna direita (relatórios, uptime, toggles, zona de perigo) seguem visuais/mock.

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
- **`projects-manager.tsx`** (`"use client"`) — `ProjectsManager`: substitui o `ProjectCard` mock.
  Recebe `projects` (DTO plano) + `hasToken` por props do Server Component. Lista projetos (testid
  `project-row`), expande um por vez buscando o log via `GET /api/projects/:id` (commits `commit-row`,
  branches `branch-row`, badge do último run via `deriveRunStatus`). Adiciona (`add-project-owner`/
  `add-project-repo` → `POST /api/projects`, valida o slug no client antes), sincroniza (`sync-now`
  → `POST /api/projects/:id/sync`; 409 → "Configure o GITHUB_PAT…") e remove (`DELETE`). Após cada
  mutação: `router.refresh()`. Badge de conexão: Conectado / Sem PAT / Nunca sincronizado.
- **`profile-cards.tsx`** (compartilhado, **sem** `"use client"`) — presentacionais reusados pelos
  forms e pelo `ProjectsManager`: `CardShell`, `ReadOnlyField` (exportados). Não usa mais `mockUser`
  nem hospeda o antigo `ProjectCard` (removido na spec 008).
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
