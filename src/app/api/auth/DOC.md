# src/app/api/auth

## Propósito
Endpoints de autenticação (SPEC §4): criar sessão (login), encerrá-la (logout) e
trocar a senha do usuário logado. Cookies só podem ser escritos aqui (Route Handler).

## Estrutura
Um `route.ts` por endpoint, em subpastas (`login/`, `logout/`, `password/`).

## Arquivos
- **`login/route.ts`** — `POST`: rate-limit por **IP e por email** → valida
  `{email,password}` (zod) → busca usuário → `verifyPassword` → `createSession` (cookie
  assinado) → `200 {role}` (zera os contadores). `401` em credencial inválida, `429` em
  excesso (qualquer dimensão), `400` em corpo inválido.
- **`logout/route.ts`** — `POST`: `destroySession()` (apaga linha + limpa cookie) → `200`. Idempotente.
- **`password/route.ts`** — `POST` (autenticado): handler **fino** — resolve a sessão, valida
  `{currentPassword,newPassword}` (zod) e **delega** ao serviço `changePassword`
  (`src/lib/account/password.ts`), que confere a senha atual, regrava o hash e invalida as
  **outras** sessões (transação). `200` ok; `401` sem sessão ou senha atual errada; `400` corpo
  inválido. Contrato inalterado (spec 007 só extraiu o núcleo p/ testar).

## O que NÃO vai aqui
- **Sem cadastro público / reset por email** (PRD §3) — fora de escopo por decisão de produto.
- **Sem hashing/HMAC inline** — delegar a `src/lib/auth/*`.
- Mensagens de erro genéricas no login (não revelar se o email existe).
