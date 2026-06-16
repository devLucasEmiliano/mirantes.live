# src/app/api/account/profile

## Propósito
`PATCH /api/account/profile` — atualiza **nome e email** do usuário logado (spec 007).

## Estrutura
Um `route.ts`.

## Arquivos
- **`route.ts`** — `PATCH`: `getCurrentUser()` (`401` sem sessão) → valida `{name,email}` com zod
  (`400`) → `updateProfile(current.id, …)`. `email_taken` → **`409`**; sucesso → **`200`** com o
  usuário (sem `passwordHash`).

## O que NÃO vai aqui
- **Foto** — é o recurso `../avatar` (multipart), não este (JSON).
- **Senha** — é `POST /api/auth/password`.
- **Detecção de colisão de email** — mora em `updateProfile` (Prisma `P2002`); aqui só o mapa p/ 409.
