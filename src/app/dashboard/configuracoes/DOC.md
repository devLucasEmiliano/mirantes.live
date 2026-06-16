# src/app/dashboard/configuracoes

## Propósito
Tela de Configurações — **exclusiva do admin** (PRD §2/§9): conta (perfil + senha), projetos e
ferramentas. Perfil e Senha são funcionais (spec 007); o resto ainda é mock.

## Estrutura
Uma página.

## Arquivos
- **`page.tsx`** (Server Component, `async`) — `await requireAdmin()` (cliente → `/dashboard`),
  depois **busca o usuário real** (`db.user.findUnique`: `name`, `email`, `createdAt`,
  `avatar.updatedAt`) e passa por props aos forms client. Formata "Membro desde" no servidor
  (evita drift de locale). Layout em duas colunas: esquerda = `ProfileForm` + `PasswordForm` +
  `ProjectCard` (mock); direita = ferramentas de admin (mock/estático).

## O que NÃO vai aqui
- **Acesso de cliente** — barrado por `requireAdmin`; nunca confiar só na ocultação no sidebar.
- **Fetch de dados nos componentes filhos** — a leitura na DAL é feita **aqui** (Server Component);
  os forms recebem props e falam com a API via `fetch`.
- **Mutações reais de settings/serviços/PAT** — entram nas suas specs próprias.
- **Segredos no cliente** (PAT etc.) — só no servidor.
