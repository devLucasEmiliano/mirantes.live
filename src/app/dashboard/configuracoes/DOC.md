# src/app/dashboard/configuracoes

## Propósito
Tela de Configurações — **exclusiva do admin** (PRD §2/§9): conta (perfil + senha), projetos e
ferramentas. Perfil/Senha (spec 007) e Projetos (spec 008) são funcionais; ferramentas seguem mock.

## Estrutura
Uma página.

## Arquivos
- **`page.tsx`** (Server Component, `async`) — `await requireAdmin()` (cliente → `/dashboard`),
  depois **busca o usuário real** (`db.user.findUnique`: `name`, `email`, `createdAt`,
  `avatar.updatedAt`) **e a lista de projetos** (`listProjects()`, mapeada p/ um DTO plano com
  `lastPolledAt` ISO) + `hasToken = Boolean(env.GITHUB_PAT)`. Formata "Membro desde" no servidor
  (evita drift de locale). Layout em duas colunas: esquerda = `ProfileForm` + `PasswordForm` +
  `ProjectsManager` (props: `projects`, `hasToken`); direita = ferramentas de admin (mock/estático).

## O que NÃO vai aqui
- **Acesso de cliente** — barrado por `requireAdmin`; nunca confiar só na ocultação no sidebar.
- **Fetch de dados nos componentes filhos** — a leitura na DAL é feita **aqui** (Server Component);
  os forms recebem props e falam com a API via `fetch`.
- **Mutações reais de settings/serviços/PAT** — entram nas suas specs próprias.
- **Segredos no cliente** (PAT etc.) — só no servidor.
