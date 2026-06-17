# src/app/api/github/connection

## Propósito
Gestão da **conexão GitHub já existente** do usuário logado (spec 009): desconectar a conta.

## Arquivos
- **`route.ts`**
  - `DELETE` — autenticado (`401` sem sessão): desconecta a conta do GitHub do usuário atual
    (`disconnectGithub(current.id)`) e responde `{ ok: true }` (`200`). **Idempotente** — sem
    conexão, ainda assim `200`. Cada usuário só mexe na SUA conexão (escopo pela sessão, nunca
    `userId` do cliente).

## O que NÃO vai aqui
- **Sem UI/JSX.**
- **Sem apagar/ler a conexão de outro usuário** — sempre o da sessão.
- **Sem lógica de persistência inline** — delega a `@/lib/github/connection`.
