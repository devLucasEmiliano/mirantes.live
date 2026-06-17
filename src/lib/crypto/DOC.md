# src/lib/crypto

## Propósito
Cifra simétrica em repouso (SPEC §11): protege o token OAuth do GitHub guardado no
Postgres com AES-256-GCM, que entrega confidencialidade **e** integridade. Único lugar
do app que cifra/decifra segredos.

## Estrutura
Um módulo (`secret.ts`), sem subpastas. Puro Node (`node:crypto`), sem dependência do
Next — testável fora do framework.

## Arquivos
- **`secret.ts`** — `encryptSecret(plaintext)` → `EncryptedSecret` e
  `decryptSecret(input)` → string, ambos AES-256-GCM. `interface EncryptedSecret`
  guarda `ciphertext`/`iv`/`authTag` em **base64**, lado a lado no banco
  (`github_connections`). A chave vem **só** de `env.GITHUB_TOKEN_ENC_KEY` (32 bytes
  base64, validada no boot). `encryptSecret` gera um **nonce GCM novo a cada chamada**
  (`randomBytes(12)` — nunca reusar IV sob a mesma chave). `decryptSecret` valida a
  `authTag` e **LANÇA** em adulteração (ciphertext/iv/authTag mexidos) ou chave errada
  — é a integridade do GCM; o chamador (`github/connection.ts`) trata como
  `invalid_token`. Depende de `node:crypto` e de `@/lib/env`.

## O que NÃO vai aqui
- **Sem UI/JSX**; sem `"use client"` — é lógica de servidor.
- **Não devolve o segredo decifrado a ninguém além do chamador imediato** — o claro
  fica em memória só p/ uso pontual (ex.: montar o client do GitHub); **nunca loga**,
  serializa nem retorna ao cliente.
- A chave **só** via `env.GITHUB_TOKEN_ENC_KEY` — jamais hardcoded, em log ou no banco.
- Sem outras primitivas (hash de senha mora em `auth/password.ts`; HMAC de cookie/state
  em `auth/cookie.ts` e `github/oauth-state.ts`).
