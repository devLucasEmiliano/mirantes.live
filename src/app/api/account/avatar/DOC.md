# src/app/api/account/avatar

## Propósito
Foto de perfil do usuário logado (spec 007), guardada como `bytea` no Postgres (tabela `avatars`)
— sem storage externo (§0). Servida e gerenciada por este recurso.

## Estrutura
Um `route.ts` com três métodos.

## Arquivos
- **`route.ts`**:
  - `GET` — serve os bytes da foto do usuário (`Content-Type` = mime gravado; `Cache-Control:
    private, no-cache`). É a `src` do `<img>`. `404` se não houver foto; `401` sem sessão.
  - `PUT` — recebe **multipart** (`file`), valida tipo+tamanho (`validateAvatar`) → `setAvatar`.
    `400` se ausente/inválido; `200` ok.
  - `DELETE` — `clearAvatar` (idempotente) → `200`.

## O que NÃO vai aqui
- **Storage externo / redimensionamento** — guardamos o byte cru validado (cap 2 MiB); escala
  futura troca o storage sem mudar o contrato do `GET`.
- **Acesso à foto de outro usuário** — sempre a do `getCurrentUser`.
- **Manipulação de bytea** — mora em `src/lib/account/avatar.ts`.
