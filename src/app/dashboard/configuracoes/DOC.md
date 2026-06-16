# src/app/dashboard/configuracoes

## Propósito
Tela de Configurações — **exclusiva do admin** (PRD §2/§9): serviços, GitHub, retenção, conta.

## Estrutura
Uma página.

## Arquivos
- **`page.tsx`** (Server Component, `async`) — chama `await requireAdmin()` no topo:
  cliente é redirecionado a `/dashboard` (defesa real no servidor, além de o item ser
  escondido no sidebar). Layout em duas colunas: a esquerda agrupa os cards de **conta
  do usuário** (Perfil do Usuário → Alterar Senha) acima do card de **Projetos**; a
  direita reúne as **ferramentas** de admin (relatórios, monitoramento, retenção, danger
  zone) — conteúdo ainda mock/estático.

## O que NÃO vai aqui
- **Acesso de cliente** — barrado por `requireAdmin`; nunca confiar só na ocultação no sidebar.
- **Mutações reais de settings/serviços/PAT** — entram nas suas specs próprias.
- **Segredos no cliente** (PAT etc.) — só no servidor.
