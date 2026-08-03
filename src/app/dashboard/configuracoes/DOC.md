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
  `avatar.updatedAt`). Formata "Membro desde" no servidor (evita drift de locale). Layout (spec
  023): **duas colunas, e só isso** — um único wrapper `flex gap-6 px-8 py-6`. Coluna esquerda
  (fluida, `min-w-0 flex-1`) = `ProfileForm` + `PasswordForm` + `<TeamsManagerCard>`; coluna
  direita (fixa, `w-[380px]`) = ferramentas de admin (`ReportsCard`, `UptimeMonitoringCard`,
  `ProjectSettingsCard`, `DangerZoneCard`, mock/estático). Equipes **deixou de ser full-width
  abaixo do bloco** (spec 022): a coluna direita tem 4 cards e a esquerda só 2, então sobrava um
  vazio ao lado de Alterar Senha e o card de Equipes ia parar no fim da página. Carrega
  `listTeams()` + `listAssignableUsers()` + `listAssignableProjects()` de `@/lib/teams` em
  paralelo. Não usa mais `listProjects`/`env`/`hasToken`/`ProjectsManager`.

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
