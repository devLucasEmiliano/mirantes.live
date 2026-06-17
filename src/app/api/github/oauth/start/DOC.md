# src/app/api/github/oauth/start

## Propósito
Primeira perna do OAuth (spec 009): inicia a autorização do GitHub para o usuário logado.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401` sem sessão): gera o `state` assinado para o usuário atual
    (`createOAuthState(current.id)`), grava-o no cookie httpOnly `gg_gh_oauth_state`
    (`OAUTH_STATE_COOKIE`) com `path` restrito a `/api/github/oauth` e `maxAge` 600 s (10 min),
    e **redireciona `307`** ao `authorize` do GitHub. A URL leva `client_id`, `redirect_uri`
    (`APP_BASE_URL/api/github/oauth/callback`), `scope` **`repo read:user`** e o `state`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem montar/assinar o `state` na mão** — delega a `@/lib/github/oauth-state`.
- **Sem trocar code por token** — isso é só do `callback/`.
