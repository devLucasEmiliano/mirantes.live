---
id: 007
title: Configurações — Perfil e Senha funcionais (+ harness de testes)
status: tests-red    # draft | approved | tests-red | done
test_levels: [unit, integration, e2e]
created: 2026-06-16
---

# 007 — Configurações: Perfil e Senha funcionais (+ harness de testes)

## Objetivo

Tornar **funcionais** os dois primeiros cards da tela `/dashboard/configuracoes`, hoje 100%
mock (todo botão é `<button type="button">` inerte):

1. **Perfil do Usuário** — editar **nome, email e foto (upload real de imagem)** com persistência
   real; "Membro desde" e email passam a refletir o banco; o avatar mostra a **imagem enviada**
   (se houver) ou as **iniciais reais** derivadas do nome.
2. **Alterar Senha** — ligar o card ao endpoint **já existente** `POST /api/auth/password`
   (spec 003), com validação de "nova == confirmar" e deslogue das demais sessões.

Como o projeto **não tinha nenhuma infraestrutura de teste** (sem Vitest/Playwright; a spec 003
usou `test_levels: []`), e um fluxo de credenciais exige testes reais (CLAUDE.md §5.1 manda e2e
para auth), esta task também **estabelece o harness de testes** — base reaproveitável pelas
specs futuras.

## Contexto e justificativa

- O backend de **troca de senha já existe e funciona** (`src/app/api/auth/password/route.ts`),
  mas nunca foi ligado à UI. Só falta o frontend + extrair a lógica para um serviço testável.
- **Perfil não tem backend nenhum**: o model `User` só tem `id, email, password_hash, role,
  created_at`. Tornar Perfil funcional **estende o schema** (`name` + tabela `avatars`) e por isso
  **atualiza PRD/SPEC junto** (CLAUDE.md §1).

## Decisões aprovadas pelo humano (registro CLAUDE.md §1) — neste chat

1. **Escopo = Perfil + Senha** (Projetos/Monitoramento ficam para specs 008+).
2. **Perfil edita Nome + Email + Foto.** Email passa a ser editável (não constava no PRD →
   atualizar PRD). **Foto = UPLOAD REAL de arquivo de imagem** (decisão de revisão: o humano
   escolheu upload binário em vez de URL).
3. **Storage da foto = Postgres `bytea`** (decisão de revisão). Os bytes ficam no Postgres — a
   fonte de verdade do projeto (§0) — **sem novas libs nem infra** (Route Handler lê
   `FormData` nativo; Prisma mapeia `Bytes → bytea`). Numa **tabela lateral `avatars`** (1:1 com
   `users`, `onDelete: Cascade`) para **não inchar a linha de `users`**, que é lida em todo
   `getCurrentUser()` (`include: { user: true }`). Servida por uma rota `GET`; validação de
   **mime** (`image/png|jpeg|webp`) e **tamanho** (cap de 2 MiB).
4. **Testes = harness completo:** Vitest (unit + integração) com **Postgres/Redis REAIS** +
   Playwright (e2e).
5. **Infra de teste = banco dedicado na LAN existente:** DB `mirantes_test` no Postgres remoto
   (mesmo servidor `192.168.0.244`, creds `postgres:postgres`) + índice Redis `1`, via
   `TEST_DATABASE_URL`/`TEST_REDIS_URL`; **truncate entre testes**; nunca o banco de dev. **Sem
   Docker/Testcontainers.**
6. **Gerenciador de pacotes = Bun** (o `package.json` tem campos Bun — `trustedDependencies`,
   `ignoreScripts` — e há `bun.lock`; o `package-lock.json` é o redundante). Harness usa
   `bunx prisma …` / `bun run dev`.

## Arquivos a criar/alterar

### Schema, seed e migração
- **Alterar** `prisma/schema.prisma` — `User` ganha `name String?` e a relação `avatar Avatar?`;
  **nova** model `Avatar` (tabela lateral `bytea`).
- **Nova migração** `bunx prisma migrate dev --name profile_and_avatar` (Prisma 7; URL via
  `prisma.config.ts`).
- **Alterar** `prisma/seed.ts` — dar `name` aos 2 usuários (admin → "Admin Mirantes",
  cliente → "Lucas Cliente").

### Camada de serviço (NOVA — torna o fluxo testável fora do runtime Next)
> A lógica de senha mora hoje **dentro do Route Handler**, que usa `getCurrentUser()` →
> `cookies()` de `next/headers` — só roda em contexto de request Next, inviável no Vitest.
> Extraímos o núcleo para serviços que recebem `userId` e batem no Postgres.

- **Criar** `src/lib/account/initials.ts` — `deriveInitials(displayName: string): string` (pura).
- **Criar** `src/lib/account/password.ts` — `changePassword(userId, { currentPassword,
  newPassword, keepSessionId })`. Retorno discriminado:
  `{ ok: true } | { ok: false, error: "invalid_current_password" | "user_not_found" }`.
  Lógica: acha user (senão `user_not_found`) → `verifyPassword` (senão
  `invalid_current_password`) → `hashPassword` → `db.$transaction([update hash, deleteMany
  sessões NOT keepSessionId])`.
- **Criar** `src/lib/account/profile.ts` — `updateProfile(userId, { name, email })`. Normaliza
  `email.toLowerCase()`; `db.user.update` (select sem `passwordHash`); em colisão de email
  (Prisma `P2002`) retorna `{ ok: false, error: "email_taken" }`; senão `{ ok: true, user }`.
- **Criar** `src/lib/account/avatar.ts`:
  - `ALLOWED_AVATAR_TYPES`, `MAX_AVATAR_BYTES` (2 MiB).
  - `validateAvatar({ mimeType, size }): { ok: true } | { ok: false, error: "unsupported_type" |
    "too_large" }` (**pura**, unit-testável).
  - `setAvatar(userId, { bytes, mimeType })` — `db.avatar.upsert` (cria/substitui).
  - `getAvatar(userId): Promise<{ data: Buffer; mimeType: string } | null>`.
  - `clearAvatar(userId)` — `db.avatar.deleteMany` (idempotente, não lança se ausente).

### Endpoints
- **Refatorar** `src/app/api/auth/password/route.ts` (`POST`): handler fino que resolve
  `getCurrentUser()` (401), valida o corpo com zod (400) e **delega** a `changePassword(current.id,
  { ..., keepSessionId: current.sessionId })`; mapeia `user_not_found`/`invalid_current_password`
  → 401, `ok` → 200. **URL e contrato inalterados.**
- **Criar** `src/app/api/account/profile/route.ts` (`PATCH`): `getCurrentUser()` (401); zod valida
  `{ name, email }` (400); chama `updateProfile`; `email_taken` → **409**; `ok` → **200** com o
  usuário (sem `passwordHash`).
- **Criar** `src/app/api/account/avatar/route.ts`:
  - `GET` — `getCurrentUser()` (401); `getAvatar`; 404 se nenhuma; senão `Response(bytes,
    { Content-Type: mime, Cache-Control: "private, no-cache" })`. É a `src` do `<img>`.
  - `PUT` — `getCurrentUser()` (401); `request.formData()` → `file` (400 se ausente/não-File);
    `validateAvatar({ mimeType: file.type, size: file.size })` (400 com o erro); grava via
    `setAvatar`; 200.
  - `DELETE` — `getCurrentUser()` (401); `clearAvatar`; 200.

### Frontend
- **Alterar** `src/app/dashboard/configuracoes/page.tsx` (server, já tem `requireAdmin()`): após o
  gate, buscar o usuário real
  `db.user.findUnique({ where: { id }, select: { name, email, createdAt, avatar: { select: {
  updatedAt } } } })`; formatar "Membro desde" no server (evita drift de locale) e passar por props
  aos forms. (Não estender `getCurrentUser()` — mantê-lo enxuto.)
- **Criar** `src/components/configuracoes/profile-form.tsx` (`"use client"`) e
  `src/components/configuracoes/password-form.tsx` (`"use client"`), espelhando
  `src/components/login/login-form.tsx` (useState, `handleSubmit` → `fetch` → trata
  200/400/401/409/429 → mensagem + `router.refresh()`). `<label htmlFor>`/`<input id>` reais.
  - `ProfileForm`: avatar mostra `<img src="/api/account/avatar?v={version}" data-testid="avatar-image">`
    se `hasAvatar`; senão `deriveInitials(name)` em `data-testid="avatar-initials"`. Input
    `<input type="file" accept="image/png,image/jpeg,image/webp" data-testid="avatar-input">`
    (sr-only) → valida tamanho/tipo no client → `PUT /api/account/avatar` (FormData) →
    `router.refresh()` + bump de `version`. Botão "Remover foto" (quando `hasAvatar`) →
    `DELETE`. Campos Nome/Email + "Membro desde" (real) + submit "Salvar Perfil" → `PATCH
    /profile`.
  - `PasswordForm`: "Senha Atual"/"Nova Senha"/"Confirmar Nova Senha" + submit "Atualizar Senha";
    valida "nova == confirmar" no client **antes** do fetch; avisa que outras sessões serão
    deslogadas.
- **Alterar** `src/components/configuracoes/profile-cards.tsx`: remover `ProfileCard`/`PasswordCard`
  mock e o uso de `mockUser`; manter `ProjectCard` + helpers (`CardShell`/`ReadOnlyField`/
  `PrimaryButton`). A page passa a importar `ProfileForm`/`PasswordForm` + `ProjectCard`.

### Harness de testes (bootstrap)
- **Novas devDependencies (Bun):** `vitest`, `@playwright/test` (sem testcontainers; `dotenv`/`tsx`
  já existem).
- **Criar** `vitest.config.ts`, `tests/setup/global-setup.ts`, `tests/setup/db.ts`,
  `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/fixtures/avatar.png` (1×1 PNG).
- **Criar** `.env.test` (git-ignored) e exemplos em `.env.example`.
- **Alterar** `package.json` — scripts `test`, `test:watch`, `test:e2e`, `test:all`.
- **Pré-requisito de DB:** o banco `mirantes_test` é criado uma vez (conectando no DB `postgres`
  com as creds de superusuário e `CREATE DATABASE`); as tabelas vêm do `global-setup` via
  `bunx prisma migrate deploy`. (O agente cria o DB neste ambiente; clones novos rodam o
  `CREATE DATABASE mirantes_test`.)

## Mudanças de schema

```prisma
model User {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique
  passwordHash String    @map("password_hash")
  role         String
  name         String?                          // NOVO
  createdAt    DateTime  @default(now()) @map("created_at")
  sessions     Session[]
  avatar       Avatar?                          // NOVO — relação 1:1 lateral
  @@map("users")
}

/// Foto do usuário guardada como bytea (sem upload de blob p/ storage externo — §0).
/// Tabela lateral p/ não carregar a imagem em todo getCurrentUser().
model Avatar {
  userId    String   @id @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  data      Bytes                                // bytea
  mimeType  String   @map("mime_type")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("avatars")
}
```

## Impacto em PRD/SPEC e DOC.md

### PRD/SPEC (atualizar na implementação)
- **SPEC §2.1** (tabela `users`): adicionar `name text null`; documentar a **nova tabela
  `avatars`** (`user_id uuid pk/fk`, `data bytea not null`, `mime_type text not null`,
  `updated_at timestamptz`).
- **PRD §9 ("Conta")**: de "troca de senha" → "editar **nome, email e foto (upload de imagem)** do
  perfil + troca de senha do usuário logado".

### DOC.md (CLAUDE.md §2.1/§2.3 — toda pasta tocada)
- **Criar:** `src/lib/account/DOC.md`, `src/app/api/account/DOC.md`,
  `src/app/api/account/profile/DOC.md`, `src/app/api/account/avatar/DOC.md`.
- **Atualizar:** `src/components/configuracoes/DOC.md`, `src/app/dashboard/configuracoes/DOC.md`,
  `src/app/api/auth/DOC.md`, `src/lib/DOC.md` (nova subpasta `account/`).
- Testes vivem em `tests/` (fora de `src/`) → sem exigência de DOC.md.

---

## Desenho dos testes

`test_levels: [unit, integration, e2e]` — proporcional: utils puros (unit), serviços contra DB real
(integração), jornadas de credenciais/upload (e2e, exigido pelo §5.1).

**Infra real vs stub (§5.3):** Postgres e Redis são **reais** (banco `mirantes_test`, índice Redis
`1`). **Nada é stubado** — não há serviço externo (GitHub/probes) envolvido. Limpeza por
**truncate** entre testes.

**Passo vermelho (§5.4):** criar `initials.ts`/`password.ts`/`profile.ts`/`avatar.ts` como **stubs**
que retornam um sentinel "não implementado" (`deriveInitials` → `""`, `validateAvatar` →
`{ ok: false, error: "unsupported_type" }` fixo, serviços async → `{ ok: false, error:
"not_implemented" as never }` / no-op) para os testes **rodarem e falharem nas asserções
concretas** (não em erro de import). Marcar `status: tests-red`. Depois implementar até **verde**,
sem alterar os testes.

### Casos — Unit (`deriveInitials`)
| entrada | esperado | borda |
|---|---|---|
| `"Lucas Cliente"` | `"LC"` | nome composto |
| `"Madonna"` | `"MA"` | token único → 2 primeiras letras |
| `"  lucas   emiliano  "` | `"LE"` | espaços extras (trim/colapso) |
| `""` | `"?"` | vazio → fallback |

### Casos — Unit (`validateAvatar`)
| entrada | esperado | borda |
|---|---|---|
| `{ image/png, 1024 }` | `{ ok: true }` | tipo válido sob o limite |
| `{ image/gif, 1024 }` | `unsupported_type` | mime fora da allowlist |
| `{ image/png, MAX+1 }` | `too_large` | acima do cap |

### Casos — Integração (`changePassword`, Postgres real)
- **happy:** user + 2 sessões (keep + other); senha atual correta → `{ ok: true }`; o hash gravado
  **valida a nova** e **não valida a antiga**; sessão **other apagada**, **keep preservada**.
- **senha atual errada:** → `{ ok: false, error: "invalid_current_password" }`; hash **inalterado**,
  sessão **intacta**.
- **user inexistente:** → `{ ok: false, error: "user_not_found" }`.

### Casos — Integração (`updateProfile`, Postgres real)
- **happy:** atualizar nome+email → `{ ok: true }`; no banco email **lowercased**, nome gravado.
- **email em uso:** atualizar para o email de outro user → `{ ok: false, error: "email_taken" }`;
  user de origem **inalterado**.

### Casos — Integração (`avatar`, Postgres real)
- **round-trip:** `setAvatar` grava PNG da fixture → `getAvatar` devolve **os mesmos bytes**
  (`Buffer.equals`) e o mime.
- **upsert:** segunda gravação **substitui** dados+mime.
- **clear idempotente:** `clearAvatar` apaga → `getAvatar` null; chamar de novo não lança.

### Casos — E2E (Playwright, app + banco de teste)
- **Senha:** login admin → configuracoes → preenche atual+nova+confirma → submit → sucesso →
  re-login com a **nova** OK / com a **antiga** falha. *(restaura a senha ao final.)*
- **Perfil (nome):** muda **nome** → submit → reload → nome persiste e iniciais atualizam.
  *(restaura o nome.)*
- **Perfil (foto):** sem foto → iniciais visíveis; `setInputFiles(avatar.png)` → "foto atualizada"
  + imagem visível; reload → persiste; "Remover foto" → volta às iniciais.
- **Validação client:** nova ≠ confirmar → erro exibido **sem** request.

---

## Os testes (código)

> Escritos para **falhar** antes da feature existir. Vitest e Playwright importados explicitamente
> (sem globals) para casar com o Biome sem config extra.

### `tests/setup/db.ts` (helpers de integração — `afterEach` global trunca)
```ts
import { afterAll, afterEach } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

/**
 * Zera as tabelas entre testes (§5.3). TRUNCATE em `users` com CASCADE limpa também
 * `sessions` e `avatars` (FK → users) — e funciona mesmo antes da migração que cria
 * `avatars` (não falha por tabela ainda inexistente no passo 1).
 */
export async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
}

export async function seedUser(input: {
  email: string;
  password: string;
  role?: string;
  name?: string | null;
}) {
  return db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role ?? "admin",
      name: input.name ?? null,
    },
  });
}

export function future(days = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

afterEach(truncateAll);
afterAll(async () => {
  await db.$disconnect();
});
```

### `tests/unit/initials.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { deriveInitials } from "@/lib/account/initials";

describe("deriveInitials", () => {
  it("usa a 1ª letra do primeiro e do último nome", () => {
    expect(deriveInitials("Lucas Cliente")).toBe("LC");
  });
  it("nome único: duas primeiras letras", () => {
    expect(deriveInitials("Madonna")).toBe("MA");
  });
  it("colapsa espaços extras", () => {
    expect(deriveInitials("  lucas   emiliano  ")).toBe("LE");
  });
  it("vazio → '?'", () => {
    expect(deriveInitials("")).toBe("?");
  });
});
```

### `tests/unit/avatar-validate.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { MAX_AVATAR_BYTES, validateAvatar } from "@/lib/account/avatar";

describe("validateAvatar", () => {
  it("aceita PNG dentro do limite", () => {
    expect(validateAvatar({ mimeType: "image/png", size: 1024 })).toEqual({
      ok: true,
    });
  });
  it("recusa tipo não suportado", () => {
    expect(validateAvatar({ mimeType: "image/gif", size: 1024 })).toEqual({
      ok: false,
      error: "unsupported_type",
    });
  });
  it("recusa acima do tamanho máximo", () => {
    expect(
      validateAvatar({ mimeType: "image/png", size: MAX_AVATAR_BYTES + 1 }),
    ).toEqual({ ok: false, error: "too_large" });
  });
});
```

### `tests/integration/password.test.ts`
```ts
import { expect, it } from "vitest";
import { changePassword } from "@/lib/account/password";
import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { future, seedUser } from "../setup/db";

it("troca a senha e invalida as OUTRAS sessões (mantém a atual)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "old-pass-123" });
  const keep = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });
  const other = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });

  const res = await changePassword(user.id, {
    currentPassword: "old-pass-123",
    newPassword: "new-pass-456",
    keepSessionId: keep.id,
  });

  expect(res).toEqual({ ok: true });
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(await verifyPassword(after.passwordHash, "new-pass-456")).toBe(true);
  expect(await verifyPassword(after.passwordHash, "old-pass-123")).toBe(false);
  expect(await db.session.findUnique({ where: { id: keep.id } })).not.toBeNull();
  expect(await db.session.findUnique({ where: { id: other.id } })).toBeNull();
});

it("recusa senha atual errada sem alterar nada", async () => {
  const user = await seedUser({ email: "b@x.com", password: "correct-pass" });
  const sess = await db.session.create({
    data: { userId: user.id, expiresAt: future() },
  });
  const before = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  const res = await changePassword(user.id, {
    currentPassword: "WRONG",
    newPassword: "whatever-123",
    keepSessionId: sess.id,
  });

  expect(res).toEqual({ ok: false, error: "invalid_current_password" });
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.passwordHash).toBe(before.passwordHash);
  expect(await db.session.findUnique({ where: { id: sess.id } })).not.toBeNull();
});

it("retorna user_not_found para id inexistente", async () => {
  const res = await changePassword("00000000-0000-0000-0000-000000000000", {
    currentPassword: "x",
    newPassword: "yyyyyyyy",
    keepSessionId: "11111111-1111-1111-1111-111111111111",
  });
  expect(res).toEqual({ ok: false, error: "user_not_found" });
});
```

### `tests/integration/profile.test.ts`
```ts
import { expect, it } from "vitest";
import { updateProfile } from "@/lib/account/profile";
import { db } from "@/lib/db";
import { seedUser } from "../setup/db";

it("atualiza nome e email (lowercased)", async () => {
  const user = await seedUser({
    email: "old@x.com",
    password: "pass-123",
    name: "Old",
  });

  const res = await updateProfile(user.id, {
    name: "Novo Nome",
    email: "NOVO@X.COM",
  });

  expect(res.ok).toBe(true);
  const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  expect(after.name).toBe("Novo Nome");
  expect(after.email).toBe("novo@x.com");
});

it("recusa email já em uso por outro usuário", async () => {
  const a = await seedUser({ email: "a@x.com", password: "pass-123", name: "A" });
  await seedUser({ email: "b@x.com", password: "pass-123", name: "B" });

  const res = await updateProfile(a.id, { name: "A", email: "b@x.com" });

  expect(res).toEqual({ ok: false, error: "email_taken" });
  const after = await db.user.findUniqueOrThrow({ where: { id: a.id } });
  expect(after.email).toBe("a@x.com");
});
```

### `tests/integration/avatar.test.ts`
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { clearAvatar, getAvatar, setAvatar } from "@/lib/account/avatar";
import { seedUser } from "../setup/db";

const PNG = readFileSync(
  fileURLToPath(new URL("../fixtures/avatar.png", import.meta.url)),
);

it("grava e lê os bytes da imagem (round-trip idêntico)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/png" });

  const got = await getAvatar(user.id);
  expect(got?.mimeType).toBe("image/png");
  expect(got?.data.equals(PNG)).toBe(true);
});

it("upsert: a segunda gravação substitui a anterior", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  await setAvatar(user.id, {
    bytes: Buffer.from([1, 2, 3]),
    mimeType: "image/png",
  });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/webp" });

  const got = await getAvatar(user.id);
  expect(got?.mimeType).toBe("image/webp");
  expect(got?.data.equals(PNG)).toBe(true);
});

it("clearAvatar remove a linha (e é idempotente)", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await setAvatar(user.id, { bytes: PNG, mimeType: "image/png" });

  await clearAvatar(user.id);
  expect(await getAvatar(user.id)).toBeNull();
  await clearAvatar(user.id); // idempotente
  expect(await getAvatar(user.id)).toBeNull();
});
```

### `tests/e2e/configuracoes.spec.ts`
```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("troca de senha: nova passa a valer, antiga falha", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Senha Atual").fill(ADMIN.password);
  await page.getByLabel("Nova Senha").fill("nova-senha-2026");
  await page.getByLabel("Confirmar Nova Senha").fill("nova-senha-2026");
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/senha atualizada/i)).toBeVisible();

  await page.goto("/login");
  await login(page, ADMIN.email, "nova-senha-2026");
  await expect(page).toHaveURL(/dashboard/);

  // Restaura a senha original para não acoplar os demais testes.
  await page.goto("/dashboard/configuracoes");
  await page.getByLabel("Senha Atual").fill("nova-senha-2026");
  await page.getByLabel("Nova Senha").fill(ADMIN.password);
  await page.getByLabel("Confirmar Nova Senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/senha atualizada/i)).toBeVisible();
});

test("perfil: editar nome persiste e atualiza as iniciais", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Nome").fill("Admin Renomeado");
  await page.getByRole("button", { name: "Salvar Perfil" }).click();
  await expect(page.getByText(/perfil atualizado/i)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Nome")).toHaveValue("Admin Renomeado");
  await expect(page.getByTestId("avatar-initials")).toHaveText("AR");

  // Restaura o nome original.
  await page.getByLabel("Nome").fill("Admin Mirantes");
  await page.getByRole("button", { name: "Salvar Perfil" }).click();
  await expect(page.getByText(/perfil atualizado/i)).toBeVisible();
});

test("perfil: upload de foto aparece, persiste e some ao remover", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await expect(page.getByTestId("avatar-initials")).toBeVisible();

  await page
    .getByTestId("avatar-input")
    .setInputFiles("tests/fixtures/avatar.png");
  await expect(page.getByText(/foto atualizada/i)).toBeVisible();
  await expect(page.getByTestId("avatar-image")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("avatar-image")).toBeVisible();

  await page.getByRole("button", { name: /remover foto/i }).click();
  await expect(page.getByText(/foto removida/i)).toBeVisible();
  await expect(page.getByTestId("avatar-initials")).toBeVisible();
});

test("senha: nova ≠ confirmar bloqueia no client (sem request)", async ({
  page,
}) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/configuracoes");

  await page.getByLabel("Senha Atual").fill(ADMIN.password);
  await page.getByLabel("Nova Senha").fill("aaaaaaaa");
  await page.getByLabel("Confirmar Nova Senha").fill("bbbbbbbb");
  await page.getByRole("button", { name: "Atualizar Senha" }).click();
  await expect(page.getByText(/não conferem|não coincidem/i)).toBeVisible();
});
```

---

## Harness (config — necessário para o passo vermelho rodar)

### `.env.test` (git-ignored) e `.env.example` (exemplos)
```dotenv
# Banco/idx de teste DEDICADOS — nunca os de dev (§5.3)
TEST_DATABASE_URL=postgresql://postgres:postgres@192.168.0.244:5432/mirantes_test
TEST_REDIS_URL=redis://192.168.0.243:6379/1
SESSION_SECRET=<32+ chars>
```
> Pré-requisito de DB (uma vez): criar `mirantes_test` no Postgres remoto (conectar no DB
> `postgres` e `CREATE DATABASE mirantes_test`). As tabelas são criadas pelo `global-setup` via
> `bunx prisma migrate deploy`.

### `vitest.config.ts`
```ts
import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: ".env.test" });

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/db.ts"],
    fileParallelism: false, // um único banco de teste; evita corrida no truncate
    // Injeta o banco de teste ANTES de @/lib/env rodar loadEnv() (resolve o hoist de ESM):
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      REDIS_URL: process.env.TEST_REDIS_URL ?? "",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "",
    },
  },
});
```

### `tests/setup/global-setup.ts`
```ts
import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config({ path: ".env.test" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL ausente — crie .env.test (ver .env.example)");
  // Prisma 7 lê DATABASE_URL via prisma.config.ts; apontamos p/ o banco de teste.
  execSync("bunx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
```

### `playwright.config.ts`
```ts
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.test" });

const PORT = 3100;
const webEnv = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
  REDIS_URL: process.env.TEST_REDIS_URL ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
  PORT: String(PORT),
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: webEnv,
  },
});
```

### `tests/e2e/global-setup.ts`
```ts
import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config({ path: ".env.test" });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL ausente (.env.test)");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    REDIS_URL: process.env.TEST_REDIS_URL ?? "",
  };
  execSync("bunx prisma migrate deploy", { stdio: "inherit", env });
  execSync("bunx prisma db seed", { stdio: "inherit", env }); // admin/cliente conhecidos
}
```

### Scripts (`package.json`)
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:all": "vitest run && playwright test"
```
> `test:all` garante a ordem **unit→integração→e2e** (§5.5: e2e só roda se o Vitest passar).

---

## Ordem de build (respeita §5.5 — não subir feature sobre base vermelha)

1. **Harness:** deps (Bun) + configs + `tests/setup/*` + `tests/fixtures/avatar.png` + `.env.test`
   + scripts; criar DB `mirantes_test` e `migrate deploy`. Validar com
   `tests/unit/initials.test.ts` (stub → vermelho).
2. **Schema + serviços + endpoints:** migração `profile_and_avatar`, seed, serviços (stubs),
   refactor `password/route.ts`, novos `profile/route.ts` + `avatar/route.ts`. Rodar
   unit+integração → **vermelho** (`status: tests-red`) → implementar → **verde**.
3. **Frontend:** page busca user real + `ProfileForm`/`PasswordForm` (+ upload). Rodar e2e →
   vermelho → implementar → verde.
4. **Fechamento:** PRD §9 + SPEC §2.1, todos os DOC.md, `biome check` + `tsc --noEmit`, marcar
   `status: done`.

## Critérios de pronto

- `name` em `users` + tabela `avatars` no schema + migração + seed; PRD §9 e SPEC §2.1 atualizados.
- Perfil edita **nome, email e foto (upload)** com persistência real; "Membro desde" e email do
  banco; avatar mostra a imagem enviada ou as iniciais reais; remover foto volta às iniciais.
- Senha troca a senha real (reusa `POST /api/auth/password`), desloga outras sessões, valida a
  confirmação.
- Serviços `changePassword`/`updateProfile`/`avatar` extraídos; handlers finos; foto validada
  (mime+tamanho).
- Todos os `test_levels` **verdes**, cada um visto **vermelho** antes; Postgres real
  (`mirantes_test`), sem mocks proibidos (§5.3).
- Biome (lint+format) e `tsc --noEmit` verdes; sem import morto (`mockUser` saiu dos cards).
- Todos os DOC.md criados/atualizados; spec marcada **`done`**.

## Verificação

- `bun run test:all` verde; rodar 1× quebrando de propósito um serviço para confirmar que o teste
  **pega** (anti-"teste de mentira", §5.4).
- Manual: `bun run db:seed` → `bun run dev` → logar admin → trocar nome/email/foto e senha →
  conferir persistência após reload e re-login com as novas credenciais.
- `bunx biome check` e `bun run typecheck` limpos.

## Fora de escopo

- Projetos, Monitoramento, Relatórios, Zona de Perigo, toggles de "Configurações de Projetos"
  (specs 008+).
- Storage externo (S3/MinIO) e redimensionamento/otimização de imagem — guardamos o bytea cru
  validado (cap 2 MiB). Escala futura pode migrar o storage sem mudar o contrato do `GET`.
- Reautenticação por senha ao trocar email (hardening possível; v1 confia na sessão).
- CI (`.github/`) — o harness roda local.
