# src/lib/account

## Propósito
Serviços de **conta do usuário** (spec 007): núcleo de perfil, senha, avatar e iniciais,
extraído dos Route Handlers para rodar **sem o runtime do Next** (recebem `userId`, batem no
Postgres). Isso os torna testáveis no Vitest com banco real.

## Estrutura
Funções puras + de acesso a dados, uma responsabilidade por arquivo. Consumidas pelos Route
Handlers de `src/app/api/account/*` e `src/app/api/auth/password`.

## Arquivos
- **`initials.ts`** — `deriveInitials(displayName)`: iniciais para o avatar sem foto (1ª letra do
  primeiro + 1ª do último nome; nome único → 2 letras; vazio → `"?"`). Pura.
- **`password.ts`** — `changePassword(userId, {currentPassword,newPassword,keepSessionId})`:
  confere a senha atual (`verifyPassword`), regrava o hash e, em **transação**, apaga as sessões
  ≠ keepSessionId. Retorno discriminado (`{ok:true}` | `invalid_current_password` | `user_not_found`).
- **`profile.ts`** — `updateProfile(userId, {name,email})`: normaliza email p/ lowercase; colisão
  de email único (Prisma `P2002`) → `email_taken`. Retorna o usuário **sem** `passwordHash`.
- **`avatar.ts`** — `validateAvatar({mimeType,size})` (allowlist PNG/JPEG/WebP + cap 2 MiB, pura),
  `setAvatar`/`getAvatar`/`clearAvatar` (upsert/leitura/remoção do `bytea` na tabela `avatars`).

## O que NÃO vai aqui
- **Sem `cookies()`/`getCurrentUser`/`next/headers`** — o serviço recebe `userId` pronto; quem
  resolve a sessão é o Route Handler. É o que permite testar fora do runtime Next.
- **Sem montar `Response` HTTP** — retornam dados/resultados discriminados; o handler mapeia p/ status.
- **Sem validação de corpo de request** — o zod fica no handler.
