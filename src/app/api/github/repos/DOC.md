# `src/app/api/github/repos/`

## Propósito
Rota que lista os repositórios da conta GitHub conectada do usuário atual, alimentando o
seletor de "adicionar projeto" em Integrações (spec 010).

## Estrutura
- `route.ts` — único arquivo; handler `GET`.

## Arquivos explicados em detalhe
- **`route.ts`** — `GET /api/github/repos` (autenticado). Fluxo: `getCurrentUser()` → 401 se sem
  sessão → `listUserRepos(current.id)` (de `@/lib/github/repos`, que resolve o token do dono e
  chama `GET /user/repos`). Mapa de erro → HTTP: `not_connected` → **409** (cai no fallback
  manual da UI, não é erro), `github_error` → **502**; sucesso → **200** `{ repos }` (cada
  `{ owner, repo, fullName, private, defaultBranch }`). Handler fino — toda a lógica vive no
  serviço.

## O que NÃO vai aqui
- Nenhuma chamada direta ao Postgres, ao GitHub ou à cifra: tudo via `listUserRepos`.
- Não filtra repos já adicionados (isso é responsabilidade do cliente, via `props.projects`).
- Não cria/edita projetos — isso é `/api/projects`.
