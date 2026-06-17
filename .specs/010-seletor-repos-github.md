---
id: 010
title: Seletor de repositórios GitHub ao adicionar projeto (Integrações)
status: done          # draft | approved | tests-red | done
test_levels: [integration, e2e]
created: 2026-06-16
---

# 010 — Seletor de repositórios GitHub (Integrações)

## Objetivo

Trocar o formulário manual de "adicionar projeto" (Nome/Owner/Repositório — redundante, pois o
nome do projeto é sempre o do repo) por um **seletor buscável** dos repositórios da conta GitHub
conectada (spec 009), mantendo a entrada manual como **fallback ("híbrido")**. O campo *Nome* sai.
**Sem mudança de schema** (leitura contra o GitHub).

## Decisões (aprovadas pelo humano via plan mode)

1. Lista **todos os repos acessíveis**: `affiliation=owner,collaborator,organization_member` (inclui
   privados, com selo `private`). **Cap de 100** (o fallback manual cobre a cauda).
2. Fake (`GITHUB_OAUTH_FAKE`) entra **depois** de `resolveUserToken` → e2e sem rede **e** usuário
   não-conectado sem repos.
3. Filtro de "já adicionados" no **cliente** (via `props.projects` + `router.refresh()`).
4. Lista buscável **custom** (sem Combobox/lib nova — CLAUDE.md §0).

## Arquivos

- **Criar:** `src/lib/github/repos.ts`, `src/app/api/github/repos/route.ts` (+ `DOC.md`),
  `tests/integration/repos.test.ts`.
- **Alterar:** `src/lib/github/client.ts` (`GhRepository` + `listRepos`), `tests/setup/github.ts`
  (`userRepos`/`userReposError`/`ghRepo`), `src/components/integracoes/projects-manager.tsx`
  (seletor + tira *Nome*), `tests/e2e/integracoes.spec.ts`, DOC.md (github lib/api/integracoes),
  `.docs/SPEC.MD`.

## Algoritmo — `listUserRepos(userId, client?)`

1. `resolveUserToken(userId)` → `!ok` ⇒ `{ ok:false, error:"not_connected" }`.
2. `client` injetado (teste) ⇒ usa-o; senão `env.GITHUB_OAUTH_FAKE==="1"` ⇒ `FAKE_REPOS`; senão
   `createGitHubClient(token).listRepos()`.
3. mapeia raw→`{ owner, repo, fullName, private, defaultBranch }`; `GitHubError` ⇒ `github_error`.

Rota `GET /api/github/repos` (autenticada): ok→200 `{ repos }`; `not_connected`→409; `github_error`→502.

`client.listRepos()` = `GET /user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`.

## Desenho dos testes

**Integração** (`tests/integration/repos.test.ts`; Postgres + cifra reais; só o `GitHubClient` stubado):
(a) sem conexão → `not_connected` mesmo com stub passado (trava a ordem "token primeiro");
(b) conectado → repos mapeados (inclui `private:true` e `defaultBranch` custom);
(c) stub cujo `listRepos` lança `GitHubError` → `github_error`.
Passo vermelho: `repos.ts` sentinela devolve `{ok:false, error:"not_impl" as never}` → 3 falhas em asserção.

**E2E** (`integracoes.spec.ts`, `GITHUB_OAUTH_FAKE=1`): mantém a criação **manual** (fallback, cliente
não-conectado) com as asserções de 404; **novo** — admin conecta (faked) → seletor mostra
`e2e-bot/hello-world` → clica → projeto aparece; `devlucasemiliano/mirantes.live` (já do admin) não é
oferecido (filtro de já-adicionado).

### `tests/integration/repos.test.ts`
```ts
import { expect, it } from "vitest";
import { GitHubError } from "@/lib/github/client";
import { connectGithub } from "@/lib/github/connection";
import { listUserRepos } from "@/lib/github/repos";
import { ghRepo, makeStubClient } from "../setup/github";
import { seedUser } from "../setup/db";

const CONN = {
  accessToken: "gho_test_token_123",
  login: "ana-gh",
  githubUserId: 4242,
  scopes: "repo,read:user",
};

function stub(userRepos: ReturnType<typeof ghRepo>[]) {
  return makeStubClient({
    defaultBranch: "main",
    commits: [],
    branches: [],
    runs: [],
    userRepos,
  });
}

it("sem conexão → not_connected (resolve o token ANTES de usar o client)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  const res = await listUserRepos(user.id, stub([ghRepo("o", "r1")]));
  expect(res).toEqual({ ok: false, error: "not_connected" });
});

it("conectado → devolve os repos mapeados", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const res = await listUserRepos(
    user.id,
    stub([
      ghRepo("o", "r1"),
      ghRepo("o", "r2", { private: true, default_branch: "dev" }),
    ]),
  );
  expect(res).toEqual({
    ok: true,
    repos: [
      { owner: "o", repo: "r1", fullName: "o/r1", private: false, defaultBranch: "main" },
      { owner: "o", repo: "r2", fullName: "o/r2", private: true, defaultBranch: "dev" },
    ],
  });
});

it("erro de borda do GitHub → github_error", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const failing = makeStubClient({
    defaultBranch: "main",
    commits: [],
    branches: [],
    runs: [],
    userReposError: new GitHubError("boom", 502),
  });
  expect(await listUserRepos(user.id, failing)).toEqual({
    ok: false,
    error: "github_error",
  });
});
```

## Notas de implementação (divergências do plano)

- **Carga do seletor:** os repos carregam na **montagem** (`useEffect` quando `connection.connected`),
  não "no primeiro foco" como o plano sugeria — melhor UX e e2e mais simples; custa 1 chamada a
  `/api/github/repos` por visita à tela (conectado). O filtro de "já adicionados" é recomputado a
  cada render a partir de `props.projects` (atualizado por `router.refresh()` após adicionar) — sem
  refetch da lista de repos.
- **`FAKE_REPOS`** inclui `devlucasemiliano/mirantes.live` de propósito: como o admin já é dono desse
  projeto (seed), o e2e confirma que ele é filtrado do seletor.

## Critérios de pronto

- `listUserRepos` + rota `GET /api/github/repos` + seletor híbrido + *Nome* removido; sem schema novo.
- `test_levels` verdes (cada visto vermelho antes); só o HTTP do GitHub stubado/faked.
- `bunx biome check` + `bun run typecheck` limpos; DOC.md + SPEC atualizados.
