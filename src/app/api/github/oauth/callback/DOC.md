# src/app/api/github/oauth/callback

## Propósito
Segunda perna do OAuth (spec 009): trata o retorno do GitHub, valida o `state` anti-CSRF,
troca o `code` pelo token e grava a conexão **cifrada** do usuário logado.

## Arquivos
- **`route.ts`**
  - `GET` — autenticado (`401` sem sessão). Se a query trouxer `error`, volta direto.
    Senão valida o `state`: precisa existir `code` + `state` + cookie, com **igualdade
    byte-a-byte** ao cookie (`timingSafeEqual`), assinatura válida e **dono = usuário atual**
    (`verifyOAuthState(...).userId === current.id`). Passando, troca o code pelo token
    (`githubOAuth.exchangeCodeForToken`), busca o usuário do GitHub
    (`githubOAuth.fetchGithubUser`) e grava a conexão (`connectGithub`, cifra em repouso).
  - **Sempre `303`** para `/dashboard/integracoes` com `?github=connected` (sucesso) ou
    `?github=error` (qualquer falha). O cookie de `state` é **one-shot**: expirado (`maxAge 0`)
    no acerto e no erro. **Nunca ecoa o erro cru** — falha é logada no servidor e vira
    `?github=error`.

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem ecoar detalhe de erro / token ao cliente** — só `connected|error` na URL.
- **Sem troca de code, chamada à API ou cifragem inline** — é `@/lib/github/oauth` e
  `@/lib/github/connection`; verificação do `state` é `@/lib/github/oauth-state`.
