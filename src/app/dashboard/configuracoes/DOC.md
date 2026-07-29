# src/app/dashboard/configuracoes

## Propósito
Tela de Configurações — **exclusiva do admin** (PRD §2/§9): conta (perfil + senha), equipes e
ferramentas. Perfil/Senha (spec 007) e Equipes (spec 022) são funcionais; ferramentas seguem
mock. A gestão de projetos e a conexão do GitHub **saíram daqui** (foram para Integrações, spec
009).

## Estrutura
Uma página.

## Arquivos
- **`page.tsx`** (Server Component, `async`) — `await requireAdmin()` (cliente → `/dashboard`),
  depois **busca o usuário real** (`db.user.findUnique`: `name`, `email`, `createdAt`,
  `avatar.updatedAt`). Formata "Membro desde" no servidor (evita drift de locale). Layout: duas
  colunas no topo (esquerda = `ProfileForm` + `PasswordForm`; direita = cartões de ferramentas de
  admin — `ReportsCard`, `UptimeMonitoringCard`, `ProjectSettingsCard`, `DangerZoneCard`, mock/
  estático) e, abaixo, **full-width** o `<TeamsManagerCard>` (spec 022) — carrega `listTeams()` +
  `listAssignableUsers()` + `listAssignableProjects()` de `@/lib/teams` em paralelo. Não usa mais
  `listProjects`/`env`/`hasToken`/`ProjectsManager`.

## O que NÃO vai aqui
- **Acesso de cliente** — barrado por `requireAdmin`; nunca confiar só na ocultação no sidebar.
  Equipes (spec 022) são geridas só aqui — a leitura compartilhada em si acontece na tela de
  Metas do MEMBRO, não aqui.
- **Gestão de projetos / conexão do GitHub** — mora em Integrações (`dashboard/integracoes`),
  aberta a admin+cliente.
- **Fetch de dados nos componentes filhos** — a leitura na DAL é feita **aqui** (Server
  Component); os forms recebem props e falam com a API via `fetch`.
- **Mutações reais de settings/serviços** — entram nas suas specs próprias.
- **Segredos no cliente** — só no servidor.
