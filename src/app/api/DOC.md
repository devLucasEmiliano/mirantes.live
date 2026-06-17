# src/app/api

## Propósito
Route Handlers (API HTTP do app, mesmo processo do Next). Servem mutações e leituras
que precisam de runtime Node (cookies, banco, Redis) — fora do render de componentes.

## Estrutura
- `auth/` — login, logout e troca de senha. Ver `auth/DOC.md`.
- `account/` — perfil e foto (avatar) do usuário logado. Ver `account/DOC.md`.
- `projects/` — projetos (listar/criar) + item (`[id]` ler/remover) + `[id]/sync` (sincronizar).
  Ver `projects/DOC.md`.
- `github/` — integração GitHub por usuário: fluxo OAuth (`oauth/start`, `oauth/callback`) e
  conexão (`connection` desconecta). Ver `github/DOC.md`.
- `events/` — `GET /api/events`: timeline paginada e escopada por papel (cursor). Ver
  `events/DOC.md`.
- (demais grupos — goals, monitoring, stream… — entram nas suas specs.)

## Arquivos
Nenhum arquivo direto nesta pasta; só subgrupos com `route.ts`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas handlers `Request → Response`.
- **Sem lógica de negócio inline** — chamar libs de `src/lib/*` (ex.: `auth/session`).
- Toda mutação valida input (zod) e autoriza por papel (SPEC §11); nada de segredo na resposta.
