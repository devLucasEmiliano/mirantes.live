# src/app/api/github

## Propósito
Route Handlers da integração **GitHub por usuário** (spec 009): o fluxo OAuth (conectar a
conta) e a gestão da conexão (desconectar). Cada usuário gere apenas a SUA conexão; o token
é cifrado em repouso (mora em `@/lib/github/*`, nunca na resposta).

## Estrutura
- `oauth/` — fluxo OAuth do GitHub (`start/` redireciona ao authorize; `callback/` troca o
  code e grava a conexão). Ver `oauth/DOC.md`.
- `connection/` — gestão da conexão existente (`DELETE` desconecta). Ver `connection/DOC.md`.

## Arquivos
Nenhum arquivo direto nesta pasta; só subgrupos com `route.ts`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas handlers `Request → Response`.
- **Sem lógica de negócio inline** — delegar a `@/lib/github/*` (`oauth`, `connection`,
  `oauth-state`).
- **Sem token/segredo na resposta, log ou URL** — o access token nunca sai do servidor; erro
  do OAuth nunca é ecoado cru ao cliente.
