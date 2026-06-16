# src/app/api/account

## Propósito
Endpoints de **conta do usuário logado** (spec 007): perfil (nome/email) e foto (avatar).
Handlers finos que resolvem a sessão (`getCurrentUser`) e delegam aos serviços de
`src/lib/account/*`.

## Estrutura
Um `route.ts` por recurso, em subpastas: `profile/`, `avatar/`.

## Arquivos
Nenhum arquivo direto nesta pasta; só subgrupos com `route.ts`. Ver `profile/DOC.md` e
`avatar/DOC.md`.

## O que NÃO vai aqui
- **Sem UI/JSX** — apenas handlers `Request → Response`.
- **Sem lógica de negócio inline** — delegar a `src/lib/account/*`.
- **Sem acesso a dados de outro usuário** — sempre o usuário da sessão; nada de `userId` vindo do
  cliente.
