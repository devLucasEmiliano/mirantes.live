# src/app/api/github/oauth

## Propósito
Fluxo **OAuth do GitHub** (spec 009) em duas pernas: iniciar a autorização e tratar o
retorno. O `state` anti-CSRF liga as duas (cookie httpOnly de vida curta) e é conferido no
callback.

## Estrutura
- `start/` — `GET`: gera o `state`, grava o cookie e redireciona ao authorize do GitHub.
  Ver `start/DOC.md`.
- `callback/` — `GET`: confere o `state`, troca o code pelo token e grava a conexão cifrada.
  Ver `callback/DOC.md`.

## Arquivos
Nenhum arquivo direto nesta pasta; só subgrupos com `route.ts`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem geração/verificação de `state` inline** — é `@/lib/github/oauth-state`.
- **Sem troca de code / chamada à API do GitHub inline** — é `@/lib/github/oauth`.
