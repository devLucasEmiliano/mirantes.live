---
id: 009
title: GitHub OAuth por usuário + token cifrado em repouso (sai o GITHUB_PAT global)
status: done         # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-16
---

# 009 — GitHub OAuth por usuário (multi-conta) + cifragem em repouso

## Objetivo

Tirar o **`GITHUB_PAT` global** e fazer **cada usuário conectar o próprio GitHub via OAuth**,
guardando o token **cifrado em repouso** (AES-256-GCM) no Postgres. Projetos passam a ter **dono**
(`Project.userId`); o sync usa o token **do dono**. Visibilidade por papel: **cliente vê só os
seus** projetos, **admin vê tudo**. Cliente **cria os seus** projetos. Contas seguem por seed (sem
cadastro público).

## Contexto e justificativa

- Hoje (spec 008) o GitHub é integrado por **1 PAT global** (`createGitHubClient(token =
  env.GITHUB_PAT)`), e `Project` **não tem dono**. Não dá p/ multi-conta nem repo privado por
  usuário.
- O humano decidiu (neste chat): **(1)** OAuth ("Conectar GitHub"), token cifrado no banco; **(2)**
  cliente vê só os seus / admin global; **(3)** contas por seed (sem signup/UI de gestão); **(4)**
  cliente cria os seus projetos (`POST /api/projects` deixa de ser admin-only); **(5)** uma spec só.
- Contraria o estado atual em 2 pontos que **esta task atualiza** (CLAUDE.md §1): o PRD single-client
  e a regra "PAT nunca vive no banco" (SPEC §2.8/§7/§11) — vira **token OAuth cifrado em repouso**.

> **Documentos-fonte:** `.docs/PRD.md`, `.docs/SPEC.MD`. **Tooling (CLAUDE.md §0):** Bun (gerenciador
> **e** runtime) — `bun install`, `bunx <bin>`, `bun run <script>`. **Nunca npm/npx/yarn/pnpm.**
> **Sem libs novas** (CLAUDE.md §0): OAuth com `fetch` nativo; cifra com `node:crypto`. Sem
> next-auth/jose/octokit.

## Decisões aprovadas pelo humano (registro CLAUDE.md §1 — neste chat)

1. **OAuth App** (não GitHub App): token OAuth por usuário, usado como `Authorization: Bearer` (igual
   ao PAT de hoje — `client.ts`/`ghGet` quase não mudam). Escopo `repo read:user`. **Sem refresh**
   em 009.
2. **Token cifrado em repouso** (AES-256-GCM), chave dedicada `GITHUB_TOKEN_ENC_KEY` (não derivada de
   `SESSION_SECRET`). Nunca em claro/log/URL/resposta ao cliente.
3. **`Project.userId`** (dono). Sync usa o token do dono. `@@unique([userId, owner, repo])`.
4. **Visibilidade por papel**: cliente → só os seus; admin → global (dashboard, switcher, "Commits da
   Semana", listagem).
5. **Cliente cria os seus** (`POST /api/projects` por-conta) e **gere a própria conexão** numa nova
   tela **`/dashboard/integracoes`** (aberta a admin+cliente). Configurações segue admin-only.
6. **Contas por seed** (PRD §2 "sem cadastro público" mantido).

## Fora de escopo (follow-ups)

- Refresh/expiração de token OAuth e **rotação** de `GITHUB_TOKEN_ENC_KEY` (multi-chave).
- GitHub App (permissões finas por-repo).
- Tela de Perfil/Senha p/ o cliente (hoje vivem em Configurações admin-only) — **não regride**, mas
  também **não** ganha versão cliente aqui.
- Timeline/eventos/SSE (segue o `// TODO(spec-timeline)` do `sync.ts`).
- Monitoramento por-projeto.

---

## Arquivos a criar / alterar

### Criar
- **`src/lib/crypto/secret.ts`** — `encryptSecret`/`decryptSecret` (AES-256-GCM).
- **`src/lib/github/oauth-state.ts`** — `createOAuthState`/`verifyOAuthState` (HMAC, espelha `cookie.ts`).
- **`src/lib/github/oauth.ts`** — `GithubOAuthExchanger` (`exchangeCodeForToken`/`fetchGithubUser`) +
  `githubOAuth` (fetch real; honra `GITHUB_OAUTH_FAKE`). Único módulo que fala com `github.com`.
- **`src/lib/github/connection.ts`** — `connectGithub`/`disconnectGithub`/`getConnectionStatus`/
  `resolveUserToken`.
- **`src/app/api/github/oauth/start/route.ts`**, **`.../callback/route.ts`**,
  **`src/app/api/github/connection/route.ts`**.
- **`src/app/dashboard/integracoes/page.tsx`** (`requireUser()`).
- **`src/components/integracoes/github-connection-card.tsx`** + **`projects-manager.tsx`** (movido de
  `components/configuracoes/`).
- Testes: `tests/unit/crypto-secret.test.ts`, `tests/unit/oauth-state.test.ts`,
  `tests/integration/github-connection.test.ts`, `tests/e2e/integracoes.spec.ts`,
  `tests/e2e/seed-connections.ts`.
- `DOC.md`: `src/lib/crypto/`, `src/app/api/github/` (+ `oauth/`, `oauth/start/`, `oauth/callback/`,
  `connection/`), `src/app/dashboard/integracoes/`, `src/components/integracoes/`.

### Alterar
- **`prisma/schema.prisma`** (+ migração à mão), **`prisma/seed.ts`** (carimba `userId`).
- **`src/lib/env.ts`** (novos vars; remove `GITHUB_PAT`), **`src/lib/github/client.ts`**
  (`createGitHubClient(token: string)` sem default env), **`sync.ts`** (`not_connected`),
  **`worker.ts`** (log), **`src/lib/projects.ts`** (escopo).
- **`src/app/api/projects/route.ts`** (POST por-conta), **`[id]/route.ts`** + **`[id]/sync/route.ts`**
  (escopo + ownership; `sync` 409 `not_connected`).
- **`src/components/layout/sidebar.tsx`** (item "Integrações"), **`app-header.tsx`** (switcher
  escopado), **`src/app/dashboard/page.tsx`** (stats escopados), **`configuracoes/page.tsx`** (tira
  projetos/`hasToken`/`env`).
- **`tests/setup/db.ts`** (truncate já cobre via cascade), **`tests/integration/sync.test.ts`**
  (`seedProject` ganha dono; `no_token`→`not_connected`), **`tests/integration/projects.test.ts`**
  (userId + escopo), **`tests/e2e/global-setup.ts`** (chama `seed-connections.ts`),
  **`tests/e2e/seed-activity.ts`** (projeto do dev pertence ao admin), **remover**
  `tests/e2e/configuracoes-projetos.spec.ts` (vira `integracoes.spec.ts`).
- **`vitest.config.ts`** (env: + novos vars, − `GITHUB_PAT`), **`playwright.config.ts`** (webEnv: +
  novos vars + `GITHUB_OAUTH_FAKE=1`), **`.env.example`**, **`.env.test`**.

---

## Mudanças de schema (`prisma/schema.prisma`)

```prisma
model User {
  // ...campos atuais...
  connection GithubConnection?
  projects   Project[]
}

/// Conexão OAuth do usuário com o GitHub. Token cifrado em repouso (AES-256-GCM).
/// Tabela lateral 1:1 (espelha Avatar) p/ não arrastar segredo em todo getCurrentUser().
model GithubConnection {
  userId          String   @id @map("user_id") @db.Uuid
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenCiphertext String   @map("token_ciphertext")
  tokenIv         String   @map("token_iv")
  tokenAuthTag    String   @map("token_auth_tag")
  githubLogin     String   @map("github_login")
  githubUserId    BigInt   @map("github_user_id")
  scopes          String
  connectedAt     DateTime @default(now()) @map("connected_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("github_connections")
}

model Project {
  // ...campos atuais...
  userId String @map("user_id") @db.Uuid
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, owner, repo])   // troca a antiga @@unique([owner, repo])
  @@index([userId])
}
```

**Migração `github_oauth_per_user`** (`bunx prisma migrate dev --name github_oauth_per_user` →
**editar o SQL** → `bunx prisma generate`). Ordem obrigatória (FK não-nula não entra em linhas
existentes):
1. `CREATE TABLE github_connections (...)` + FK cascade.
2. `ALTER TABLE projects ADD COLUMN user_id UUID;` (**nullable**).
3. `UPDATE projects SET user_id = (SELECT id FROM users WHERE role='admin' ORDER BY created_at ASC LIMIT 1) WHERE user_id IS NULL;`
4. `ALTER TABLE projects ALTER COLUMN user_id SET NOT NULL;`
5. `DROP INDEX projects_owner_repo_key;` + `CREATE UNIQUE INDEX projects_user_id_owner_repo_key ON projects(user_id, owner, repo);` + `CREATE INDEX projects_user_id_idx ON projects(user_id);`
6. `ALTER TABLE projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`

DB de teste vazio → passo 3 é no-op (sem linhas). Pressupõe um admin existir p/ linhas
pré-existentes (seed cria o admin antes; e2e roda `db seed` antes do pré-seed).

**`prisma/seed.ts`**: após o upsert dos usuários, pegar o admin e carimbar o projeto dev:
`where: { userId_owner_repo: { userId: admin.id, owner, repo } }`, `create/update` com `userId:
admin.id`. **Sem token no seed.**

---

## Algoritmos

### Cifra — `src/lib/crypto/secret.ts`
```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

export interface EncryptedSecret { ciphertext: string; iv: string; authTag: string } // base64

function key(): Buffer { return Buffer.from(env.GITHUB_TOKEN_ENC_KEY, "base64"); } // 32 bytes (validado no env)

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(12);                                  // nonce GCM novo a cada chamada
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptSecret(input: EncryptedSecret): string {   // lança em adulteração/chave errada
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
```

### State OAuth — `src/lib/github/oauth-state.ts` (espelha `cookie.ts`)
`createOAuthState(userId, now = Date.now())`: payload `${userId}.${randomBytes(16).base64url}.${now+TTL}`,
assina com `createHmac("sha256", env.SESSION_SECRET)`, retorna `payload.sig`. TTL = 600_000 ms.
`verifyOAuthState(token, now = Date.now()) → { userId } | null`: split no último `.`, length-check +
`timingSafeEqual` na sig, rejeita se `now > expiry` ou estrutura inválida.

### OAuth HTTP — `src/lib/github/oauth.ts`
`exchangeCodeForToken(code)` → `POST https://github.com/login/oauth/access_token` (`Accept: json`,
body `client_id/client_secret/code/redirect_uri`), lança `GithubOAuthError` (sem secret/code) em
`data.error`/sem `access_token`. `fetchGithubUser(token)` → `GET https://api.github.com/user`.
Quando `env.GITHUB_OAUTH_FAKE === "1"`: devolve `{ accessToken:"gho_e2e_fake", scope:"repo,read:user",
tokenType:"bearer" }` e `{ login:"e2e-bot", id:4242, avatarUrl:null }` **sem rede**.

### Rotas OAuth
- `GET /api/github/oauth/start` (auth): `state = createOAuthState(user.id)`; grava cookie httpOnly
  `gg_gh_oauth_state` (forma de `buildSessionCookieOptions`, `path:"/api/github/oauth"`, `maxAge:600`);
  `307` → `authorize?client_id&redirect_uri=${APP_BASE_URL}/api/github/oauth/callback&scope=repo read:user&state`.
- `GET /api/github/oauth/callback` (auth): se `?error` → `303 /dashboard/integracoes?github=error`;
  lê+**apaga** o cookie; `verifyOAuthState(state)` **e** `state === cookie` (byte-safe) e `userId ===
  current.id`; `exchangeCodeForToken` → `fetchGithubUser` → `connectGithub(user.id, …)` → `303
  ?github=connected`. Qualquer falha → `303 ?github=error` (nunca ecoa erro cru).
- `DELETE /api/github/connection` (auth): `disconnectGithub(current.id)` → `{ ok:true }`.

### Conexão — `src/lib/github/connection.ts`
`connectGithub(userId, { accessToken, login, githubUserId, scopes })`: `encryptSecret(accessToken)` →
`db.githubConnection.upsert`. `getConnectionStatus(userId) → { connected, githubLogin, connectedAt }`
(**nunca** token). `resolveUserToken(userId)`: sem row → `{ok:false, error:"not_connected"}`;
`decryptSecret` lança → `{ok:false, error:"invalid_token"}`; senão `{ok:true, token}`.
`disconnectGithub(userId)`: `deleteMany` (idempotente).

### Sync — `src/lib/github/sync.ts`
`SyncResult` erro vira `"project_not_found" | "not_connected" | "github_error"` (sai `no_token`).
`syncProject(projectId, client?)`: carrega projeto (com `userId`) → se `client` injetado, usa-o; senão
`resolveUserToken(project.userId)` (≠ ok → `not_connected`) → `createGitHubClient(token)`. Resto igual.
`createGitHubClient(token: string)` perde o default `env.GITHUB_PAT` (e o import de `env`).

### Escopo — `src/lib/projects.ts`
`type Scope = { role: "admin" } | { role: "client"; userId: string }`. `createProject(input & {
userId })`. `listProjects/getProject/deleteProject/weeklyCommitStats/latestCommit` recebem `Scope`;
cliente filtra por `userId` (id alheio → `not_found`), admin global. Rotas passam o scope vindo de
`getCurrentUser()`; `POST /api/projects` = qualquer logado (carimba `userId`).

---

## Impacto em PRD/SPEC e DOC.md

- **PRD** §1/§2 (cliente vê só os seus; admin global; gestão de GitHub/projetos numa **Integrações**
  aberta a admin+cliente; "sem cadastro público" mantido), §8 (OAuth por usuário; token cifrado no
  banco), §9 (Configurações admin-only só p/ ferramentas; projetos→Integrações), §12 (linha
  "PAT no servidor" → "OAuth por usuário, token cifrado no banco").
- **SPEC** §2.8 (token OAuth **cifrado** no banco + `github_connections` + `projects.user_id` +
  `@@unique([user_id,owner,repo])`), §7 (`no_token`→`not_connected`; token do dono decifrado em
  memória), §11 (cifra em repouso + `state`/CSRF/`redirect_uri`), tabela §4 (rotas `/api/github/*`;
  `/api/projects*` escopado por papel).
- **DOC.md**: criar os das pastas novas; atualizar `src/lib/github/DOC.md`, `src/lib/DOC.md`,
  `src/app/api/projects/**`, `src/app/dashboard/DOC.md`, `src/app/dashboard/configuracoes/DOC.md`,
  `src/components/layout/DOC.md`, `src/components/configuracoes/DOC.md`.

---

## Desenho dos testes

**Infra real (§5.3):** Postgres `mirantes_test`; **cifra real** (chave em `.env.test`); HMAC real.
**Único externo stubado = HTTP ao GitHub**: nos integração via `makeStubClient` (sync) e tokens
literais (connection — sem troca OAuth); no e2e via `GITHUB_OAUTH_FAKE=1`. Limpeza por truncate (o
cascade de `users`/`projects` já apaga `github_connections`/`projects`/filhos).

**Passo vermelho (§5.4):** sentinelas — `crypto/secret.ts`: `encryptSecret=(p)=>({ciphertext:p,iv:"",authTag:""})`,
`decryptSecret=()=>"__sentinel__"`; `oauth-state.ts`: `createOAuthState=()=>""`, `verifyOAuthState=()=>({userId:"__sentinel__"})`;
`connection.ts`: serviços async → `{ok:false, error:"not_impl" as never}` / `getConnectionStatus=()=>({connected:false,githubLogin:null,connectedAt:null})`;
`projects.ts`/`sync.ts` ajustados p/ devolver neutro. Rodar → **vermelho nas asserções concretas** →
`status: tests-red` → implementar até verde **sem alterar os testes**. Validar 1× quebrando a cifra de
propósito (adulterar o authTag e ver o teste de tamper pegar).

### Casos — Unit
| arquivo | caso | esperado |
|---|---|---|
| crypto-secret | round-trip `gho_…`/unicode | `decrypt(encrypt(x))===x`; `ciphertext!==x` |
| crypto-secret | 2 encrypts do mesmo texto | `iv` e `ciphertext` distintos |
| crypto-secret | adulterar ciphertext/iv/authTag | `decrypt` **lança** |
| oauth-state | verify(create(u,t), t+1s) | `{userId:u}` |
| oauth-state | expirado (t+11min) / sig adulterada / lixo / null | `null` |
| oauth-state | 2 states do mesmo user | strings distintas (nonce) |

### Casos — Integração
- **connection**: `connect`→row com `tokenCiphertext!==token` e `githubLogin` certo; `resolveUserToken`
  round-trip; `not_connected` (sem row); `invalid_token` (ciphertext corrompido); `getConnectionStatus`
  **sem** token; `disconnect` remove; apagar **User** cascateia a conexão.
- **sync** (mantém os 5 com stub injetado): `no_token`→**`not_connected`** (dono sem conexão, sem rede).
- **projects**: `create` carimba dono; dup `(user,owner,repo)`→`already_exists`; **mesmo repo p/ users
  diferentes** OK; `listProjects` (A vê 2, B vê 1, admin vê 3); `getProject`/`deleteProject` ownership
  (id alheio→`not_found`, intacto); `weeklyCommitStats`/`latestCommit` escopados; apagar User cascateia.

### Casos — E2E (Playwright, `GITHUB_OAUTH_FAKE=1`; pré-seed determinístico)
- admin **conecta** (start→state/cookie→callback faked)→"Conectado como @e2e-bot"→**desconecta**.
- cliente vê **só os seus** projetos em Integrações (não vê o repo do admin); admin vê **todos**.
- RBAC: cliente em `/integracoes`→200; em `/configuracoes`→redirect `/dashboard`.
- cliente **sincroniza sem conexão**→"Conecte sua conta do GitHub".
- cliente **cria** o seu projeto; cliente **não** sincroniza/apaga projeto alheio via API (**404**).

---

## Os testes (código)

### `tests/unit/crypto-secret.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";

function flip(b64: string): string {
  return (b64[0] === "A" ? "B" : "A") + b64.slice(1);
}

describe("encryptSecret/decryptSecret", () => {
  it("round-trip de um token gho_", () => {
    const plain = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
    const enc = encryptSecret(plain);
    expect(enc.ciphertext).not.toBe(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });
  it("round-trip de unicode", () => {
    const plain = "tökèn—çãó-🔐";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });
  it("gera IV/ciphertext distintos a cada encrypt (nonce GCM não reusa)", () => {
    const a = encryptSecret("mesmo-texto");
    const b = encryptSecret("mesmo-texto");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
  it("lança ao adulterar o ciphertext", () => {
    const enc = encryptSecret("segredo");
    expect(() => decryptSecret({ ...enc, ciphertext: flip(enc.ciphertext) })).toThrow();
  });
  it("lança ao adulterar o authTag", () => {
    const enc = encryptSecret("segredo");
    expect(() => decryptSecret({ ...enc, authTag: flip(enc.authTag) })).toThrow();
  });
  it("lança ao adulterar o iv", () => {
    const enc = encryptSecret("segredo");
    expect(() => decryptSecret({ ...enc, iv: flip(enc.iv) })).toThrow();
  });
});
```

### `tests/unit/oauth-state.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "@/lib/github/oauth-state";

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = 1_750_000_000_000;

describe("oauth-state", () => {
  it("verifica um state recém-criado e devolve o userId", () => {
    expect(verifyOAuthState(createOAuthState(USER, NOW), NOW + 1000)).toEqual({ userId: USER });
  });
  it("rejeita state expirado", () => {
    expect(verifyOAuthState(createOAuthState(USER, NOW), NOW + 11 * 60 * 1000)).toBeNull();
  });
  it("rejeita assinatura adulterada (dentro do TTL)", () => {
    const state = createOAuthState(USER, NOW);
    expect(verifyOAuthState(`${state.slice(0, -2)}XX`, NOW + 1000)).toBeNull();
  });
  it("rejeita lixo/null", () => {
    expect(verifyOAuthState("nao-e-um-state")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
  });
  it("dois states do mesmo user diferem (nonce)", () => {
    expect(createOAuthState(USER, NOW)).not.toBe(createOAuthState(USER, NOW));
  });
});
```

### `tests/integration/github-connection.test.ts`
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  connectGithub, disconnectGithub, getConnectionStatus, resolveUserToken,
} from "@/lib/github/connection";
import { seedUser } from "../setup/db";

const CONN = { accessToken: "gho_test_token_123", login: "ana-gh", githubUserId: 4242, scopes: "repo,read:user" };

it("connect cifra o token (não grava em claro) e resolveUserToken devolve o claro", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const row = await db.githubConnection.findUniqueOrThrow({ where: { userId: user.id } });
  expect(row.tokenCiphertext).not.toBe(CONN.accessToken);
  expect(row.githubLogin).toBe("ana-gh");
  expect(await resolveUserToken(user.id)).toEqual({ ok: true, token: "gho_test_token_123" });
});

it("resolveUserToken → not_connected sem conexão", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  expect(await resolveUserToken(user.id)).toEqual({ ok: false, error: "not_connected" });
});

it("resolveUserToken → invalid_token com ciphertext corrompido", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await db.githubConnection.update({ where: { userId: user.id }, data: { tokenCiphertext: "Y29ycnVwdG8=" } });
  expect(await resolveUserToken(user.id)).toEqual({ ok: false, error: "invalid_token" });
});

it("getConnectionStatus não expõe o token", async () => {
  const user = await seedUser({ email: "d@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const status = await getConnectionStatus(user.id);
  expect(status.connected).toBe(true);
  expect(status.githubLogin).toBe("ana-gh");
  expect(JSON.stringify(status)).not.toContain("gho_test_token_123");
});

it("disconnect remove a conexão", async () => {
  const user = await seedUser({ email: "e@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await disconnectGithub(user.id);
  expect(await db.githubConnection.findUnique({ where: { userId: user.id } })).toBeNull();
  expect(await getConnectionStatus(user.id)).toEqual({ connected: false, githubLogin: null, connectedAt: null });
});

it("apagar o usuário cascateia a conexão", async () => {
  const user = await seedUser({ email: "f@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  await db.user.delete({ where: { id: user.id } });
  expect(await db.githubConnection.count()).toBe(0);
});
```

### `tests/integration/sync.test.ts` (mudanças)
`seedProject` ganha um dono; o teste `no_token` vira `not_connected` (os 5 com stub injetado ficam):
```ts
async function seedProject() {
  const owner = await db.user.create({ data: { email: "owner@x.com", passwordHash: "x", role: "admin" } });
  return db.project.create({
    data: { userId: owner.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" },
  });
}

// (substitui o antigo "no_token")
it("dono sem conexão e sem client injetado → not_connected (sem rede)", async () => {
  const project = await seedProject();
  const res = await syncProject(project.id); // dono não tem GithubConnection
  expect(res).toEqual({ ok: false, error: "not_connected" });
});
```

### `tests/integration/projects.test.ts` (reescrita)
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createProject, deleteProject, getProject, latestCommit, listProjects, weeklyCommitStats,
} from "@/lib/projects";
import { seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;
const mkUser = (email: string, role = "client") => seedUser({ email, password: "pass-123", role });
const day = 24 * 60 * 60 * 1000;
const commit = (projectId: string, sha: string, ageDays = 1) =>
  db.commit.create({ data: { projectId, sha, message: "m", author: "a", committedAt: new Date(Date.now() - ageDays * day) } });

it("cria projeto válido e carimba o dono", async () => {
  const u = await mkUser("a@x.com");
  const res = await createProject({ userId: u.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live" });
  if (!res.ok) throw new Error("setup");
  expect(res.project.userId).toBe(u.id);
  expect(await db.project.count()).toBe(1);
});
it("rejeita slug inválido sem gravar", async () => {
  const u = await mkUser("a@x.com");
  expect(await createProject({ userId: u.id, name: "X", owner: "a b", repo: "x" })).toEqual({ ok: false, error: "invalid_slug" });
  expect(await db.project.count()).toBe(0);
});
it("rejeita (owner,repo) duplicado para o MESMO usuário", async () => {
  const u = await mkUser("a@x.com");
  await createProject({ userId: u.id, name: "X", owner: "o", repo: "r" });
  expect(await createProject({ userId: u.id, name: "Y", owner: "o", repo: "r" })).toEqual({ ok: false, error: "already_exists" });
  expect(await db.project.count()).toBe(1);
});
it("o mesmo repo pode existir para usuários diferentes", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  await createProject({ userId: a.id, name: "A", owner: "o", repo: "r" });
  expect((await createProject({ userId: b.id, name: "B", owner: "o", repo: "r" })).ok).toBe(true);
  expect(await db.project.count()).toBe(2);
});
it("listProjects: cliente vê só os seus; admin vê todos", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  await createProject({ userId: a.id, name: "A1", owner: "o", repo: "a1" });
  await createProject({ userId: a.id, name: "A2", owner: "o", repo: "a2" });
  await createProject({ userId: b.id, name: "B1", owner: "o", repo: "b1" });
  expect((await listProjects(asClient(a.id))).projects.map((p) => p.name).sort()).toEqual(["A1", "A2"]);
  expect((await listProjects(asClient(b.id))).projects.map((p) => p.name)).toEqual(["B1"]);
  expect((await listProjects(ADMIN)).projects).toHaveLength(3);
});
it("getProject: cliente em projeto alheio → not_found", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const c = await createProject({ userId: a.id, name: "A", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  expect(await getProject(c.project.id, asClient(b.id))).toEqual({ ok: false, error: "not_found" });
  expect((await getProject(c.project.id, asClient(a.id))).ok).toBe(true);
  expect((await getProject(c.project.id, ADMIN)).ok).toBe(true);
});
it("deleteProject: cliente não apaga projeto alheio", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const c = await createProject({ userId: a.id, name: "A", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  expect(await deleteProject(c.project.id, asClient(b.id))).toEqual({ ok: false, error: "not_found" });
  expect(await db.project.count()).toBe(1);
  expect(await deleteProject(c.project.id, asClient(a.id))).toEqual({ ok: true });
});
it("weeklyCommitStats escopado por dono", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const pa = await createProject({ userId: a.id, name: "A", owner: "o", repo: "a" });
  const pb = await createProject({ userId: b.id, name: "B", owner: "o", repo: "b" });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await commit(pa.project.id, "a1", 1); await commit(pa.project.id, "a2", 2); await commit(pb.project.id, "b1", 1);
  expect(await weeklyCommitStats(asClient(a.id))).toEqual({ count: 2, previousCount: 0 });
  expect(await weeklyCommitStats(asClient(b.id))).toEqual({ count: 1, previousCount: 0 });
  expect(await weeklyCommitStats(ADMIN)).toEqual({ count: 3, previousCount: 0 });
});
it("latestCommit escopado por dono", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const pa = await createProject({ userId: a.id, name: "ProjA", owner: "o", repo: "a" });
  const pb = await createProject({ userId: b.id, name: "ProjB", owner: "o", repo: "b" });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await db.commit.create({ data: { projectId: pa.project.id, sha: "ca", message: "m", author: "a", committedAt: new Date("2026-06-01T00:00:00Z") } });
  await db.commit.create({ data: { projectId: pb.project.id, sha: "cb", message: "m", author: "a", committedAt: new Date("2026-06-10T00:00:00Z") } });
  expect((await latestCommit(asClient(a.id)))?.projectName).toBe("ProjA");
  expect((await latestCommit(ADMIN))?.sha).toBe("cb");
});
it("apagar o usuário cascateia projetos e filhos", async () => {
  const u = await mkUser("a@x.com");
  const c = await createProject({ userId: u.id, name: "A", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  await commit(c.project.id, "x1");
  await db.user.delete({ where: { id: u.id } });
  expect(await db.project.count()).toBe(0);
  expect(await db.commit.count()).toBe(0);
});
```

### `tests/e2e/integracoes.spec.ts`
```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };
const CLIENT = { email: "cliente@mirantes.live", password: "cliente-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("admin conecta o GitHub (OAuth faked) e desconecta", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const start = await page.request.get("/api/github/oauth/start", { maxRedirects: 0 });
  const state = new URL(start.headers().location).searchParams.get("state");
  const cb = await page.request.get(`/api/github/oauth/callback?code=fake&state=${state}`, { maxRedirects: 0 });
  expect(cb.status()).toBe(303);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText(/conectado como @e2e-bot/i)).toBeVisible();
  await page.getByRole("button", { name: /desconectar/i }).click();
  await expect(page.getByRole("button", { name: /conectar github/i })).toBeVisible();
});

test("cliente vê só os seus projetos; admin vê todos", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText("cliente-owner/cliente-repo")).toBeVisible();
  await expect(page.getByText("devlucasemiliano/mirantes.live")).toHaveCount(0);

  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/integracoes");
  await expect(page.getByText("devlucasemiliano/mirantes.live")).toBeVisible();
  await expect(page.getByText("cliente-owner/cliente-repo")).toBeVisible();
});

test("cliente acessa Integrações mas não Configurações", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await expect(page).toHaveURL(/\/integracoes$/);
  await page.goto("/dashboard/configuracoes");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("cliente: sincronizar sem conexão pede para conectar", async ({ page }) => {
  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await page.getByTestId("sync-now").first().click();
  await expect(page.getByText(/conecte sua conta do github/i)).toBeVisible();
});

test("cliente cria o seu projeto e não toca no de outro (404)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  const adminId = (await (await page.request.get("/api/projects")).json()).projects
    .find((p: { repo: string }) => p.repo === "mirantes.live").id;

  await login(page, CLIENT.email, CLIENT.password);
  await page.goto("/dashboard/integracoes");
  await page.getByTestId("add-project-owner").fill("cli-novo");
  await page.getByTestId("add-project-repo").fill("repo-novo");
  await page.getByRole("button", { name: /adicionar projeto/i }).click();
  await expect(page.getByText("cli-novo/repo-novo")).toBeVisible();

  expect((await page.request.post(`/api/projects/${adminId}/sync`)).status()).toBe(404);
  expect((await page.request.delete(`/api/projects/${adminId}`)).status()).toBe(404);
});
```

### `tests/e2e/seed-connections.ts` (pré-seed determinístico)
`bun run` no `global-setup` (após `db seed` + `seed-activity`): garante que o **projeto dev pertence
ao admin** (já via seed) e cria um **projeto do cliente** `cliente-owner/cliente-repo` (`userId =
cliente`) com 2 commits + branch `main` + 1 run. **Sem** conexões pré-semeadas (o teste de conectar usa
o fluxo faked; o de sync-sem-conexão depende de não haver conexão). Idempotente (`createMany
skipDuplicates`/`upsert`). `seed-activity.ts` passa a carimbar o `userId` do admin no projeto dev.

> **Nota e2e:** os testes de projeto da spec 008 (`configuracoes-projetos.spec.ts`) **migram** p/ cá
> (a gestão saiu de Configurações). O arquivo 008 é **removido**.

---

## Novos env (`src/lib/env.ts`)
`GITHUB_OAUTH_CLIENT_ID` (min 1), `GITHUB_OAUTH_CLIENT_SECRET` (min 1), `GITHUB_TOKEN_ENC_KEY`
(`.refine(v => Buffer.from(v,"base64").length === 32)`), `APP_BASE_URL` (url), `GITHUB_OAUTH_FAKE`
(optional). **Remover** `GITHUB_PAT`. Espelhar em `vitest.config.ts` `env` (os 4 obrigatórios +
gerar uma `GITHUB_TOKEN_ENC_KEY` base64 de 32 bytes; **−** `GITHUB_PAT`) e em `playwright.config.ts`
`webEnv` (os 4 + `GITHUB_OAUTH_FAKE=1`). `.env.example`/`.env.test` atualizados.

---

## Ordem de build (respeita §5.5)
1. `env.ts` + `crypto/secret.ts` → **unit** (vermelho→verde, sem DB).
2. `oauth-state.ts` → **unit**.
3. Schema + migração (à mão) + `generate` + seed (carimba dono). **Gate de DB.**
4. `connection.ts` → **integração** (Postgres + cifra real).
5. `oauth.ts` (com `GITHUB_OAUTH_FAKE`) + rotas `start`/`callback`/`connection`.
6. `sync.ts` (`not_connected`) + `client.ts` (sem default env) + `worker.ts` → editar `sync.test.ts` → **integração**.
7. Escopo (`projects.ts` + rotas `/api/projects*` + `app-header` + `dashboard/page`) → reescrever `projects.test.ts` → **integração**.
8. UI/RBAC: `integracoes/page` + `github-connection-card` + `ProjectsManager` (prop `connection`); sidebar "Integrações"; tirar projetos/`hasToken` de Configurações.
9. **E2E** `seed-connections.ts` + `integracoes.spec.ts` (remover `configuracoes-projetos.spec.ts`).
10. Docs (todos os `DOC.md` + PRD/SPEC); `bunx biome check` + `bun run typecheck`; `status: done`.

## Notas de implementação (divergências do plano)

Ajustes registrados (§3.2 — registro vivo da decisão final):

- **`createGitHubClient(token: string): GitHubClient`** perdeu também o retorno `| null` (não só o default `env.GITHUB_PAT`): como `resolveUserToken` já garante um token não-vazio antes da chamada, o guard `if (!token) return null` virava código morto. O caso "sem token" é tratado só em `resolveUserToken`/`syncProject` (`not_connected`).
- **Ownership do `POST /api/projects/:id/sync`**: reaproveita `getProject(id, scope)` (já escopado) p/ o 404 de projeto alheio, em vez de criar uma função nova em `projects.ts` — mantém a porta única ao Postgres sem ampliar a API.
- **Passo vermelho de `connection.ts`**: o sentinela usou `connectGithub` REAL (grava a linha cifrada) + sentinelas nos serviços de leitura/`disconnect`, levando 5/6 testes a falharem em **asserção**; o 6º (cascade ao apagar o `User`) é invariante de schema, já garantido pela FK `ON DELETE CASCADE` da migração.

## Critérios de pronto
- `GithubConnection` + `Project.userId` + migração/backfill + seed; PRD/SPEC/DOC.md atualizados.
- Cada usuário **conecta/desconecta** o GitHub (OAuth, token cifrado, nunca exposto); sync usa o token
  **do dono**; **cliente vê/gere só os seus**, **admin global**; cliente **cria os seus**.
- `GITHUB_PAT` removido (sem consumidores).
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres + cifra reais; só o
  HTTP do GitHub stubado. Quebrar 1× o authTag p/ confirmar o teste de tamper (§5.4).
- `bunx biome check` + `bun run typecheck` limpos; sem import morto.

## Verificação
- `bun run test:all` verde (parar `next dev` antes do e2e — lock do Next 16).
- **Manual:** registrar um **OAuth App** no GitHub (callback `…/api/github/oauth/callback`), preencher
  `GITHUB_OAUTH_CLIENT_ID/SECRET`, `GITHUB_TOKEN_ENC_KEY` (`openssl rand -base64 32`), `APP_BASE_URL` →
  `bun run db:migrate` + `db:seed` → `bun run dev` → Integrações → "Conectar GitHub" → autorizar →
  "Conectado como @você" → adicionar **repo privado** → "Sincronizar Agora" → commits/Actions/branches;
  logar como **cliente** e ver só os seus; **Desconectar** volta ao CTA.
- `bun run worker:github` sincroniza por projeto com o token do dono, sem vazar token no log.
