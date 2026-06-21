---
id: 020
title: Robustez do sync — paginação de commits + janela de cursor com overlap
status: draft        # draft | approved | tests-red | done
test_levels: [unit, integration]
created: 2026-06-21
---

# 020 — Robustez do sync (paginação + cursor com overlap)

## Objetivo

O sync incremental funciona (puxa `since = lastPolledAt`, deduplica por `(project, sha)`), mas a
investigação do fluxo expôs **dois pontos frágeis reais** que podem fazer commits **sumirem**
silenciosamente. Esta task fecha os dois buracos sem mudar a arquitetura do sync.

1. **Sem paginação** — `createGitHubClient.listCommits` (`src/lib/github/client.ts:125-133`) faz **1
   chamada** com `per_page=100` e devolve só a 1ª página. Se entrarem **>100 commits novos** numa
   janela (1º sync de repo grande, ou worker parado por um tempo), o excedente é **perdido**.
2. **Cursor por relógio de parede** — `since = project.lastPolledAt?.toISOString()`
   (`src/lib/github/sync.ts:58`) e `lastPolledAt` é gravado como `new Date()` no fim do sync
   (`sync.ts:151`). O `since` do GitHub filtra por **data do commit**. Commits com data **retroativa**
   (rebase, push atrasado, clock skew entre o autor e o servidor) que sejam mais antigos que o último
   poll **nunca** entram na janela → nunca ingeridos.

Decisão (AskUserQuestion, sessão de plano): corrigir os dois numa task só (são o mesmo subsistema).

## Contexto e justificativa

- **Paginação** é detalhe do cliente HTTP real (`createGitHubClient`), não do contrato. O `GitHubClient`
  continua devolvendo `GhCommit[]`; o stub de teste (`tests/setup/github.ts:24`) já devolve tudo de
  uma vez, então o **núcleo `syncProject` não muda** por causa da paginação. O GitHub pagina via header
  `Link: <…&page=2>; rel="next"` (REST v3). Teto de segurança `MAX_COMMIT_PAGES` evita varrer histórico
  gigante de uma vez e **loga** quando trunca (princípio "no silent caps" — melhor avisar que truncou
  do que fingir cobertura total).
- **Overlap** resolve o cursor sem reescrever a lógica: em vez de `since = lastPolledAt`, usa
  `since = lastPolledAt - OVERLAP`. Re-busca uma janelinha já vista, mas o **dedupe já existente** zera
  o custo de duplicação: `existingShas` (`sync.ts:71-78`) filtra eventos e `createMany(skipDuplicates)`
  (`sync.ts:80`) ignora linhas repetidas. Atribuição só roda em `newShas` (`sync.ts:158-160`). Logo o
  overlap é **seguro por construção**: zero linha duplicada, zero evento duplicado, zero atribuição
  duplicada. Troca-se um pouco de fetch redundante por **não perder commit**.
- O overlap **não** substitui a paginação nem vice-versa: o overlap aumenta a janela (pode trazer
  >100), e a paginação garante que essa janela maior seja lida por inteiro. Os dois se completam.

## Dependência de ordem (CLAUDE.md §5.5)

Independente. Só depende do núcleo `syncProject` (verde desde 008/013) e do cliente (008). Roda antes
da 021 porque ambas tocam `sync.ts` (evita conflito de merge).

## Mudanças de schema

Nenhuma. (`lastPolledAt`/`lastSeenSha` já existem em `prisma/schema.prisma`.)

## Arquivos a criar / alterar

### Criar
- **`src/lib/github/cursor.ts`** — helper puro `resolveSince` (ver Contratos). Mantém `sync.ts` enxuto
  e o helper isolado p/ unit sem infra.
- **`tests/unit/github-cursor.test.ts`**, **`tests/unit/github-client-pagination.test.ts`**,
  **`tests/integration/sync-overlap.test.ts`**.

### Alterar
- **`src/lib/github/client.ts`**:
  - exportar `parseNextLink(linkHeader: string | null): string | null` (puro).
  - `ghGet` passa a expor headers — extrair `ghGetWithHeaders<T>` que devolve `{ data, headers }`
    (o `ghGet` atual delega a ele e descarta headers, mantendo as demais chamadas iguais).
  - `listCommits` vira um laço: segue `rel="next"` acumulando, até `MAX_COMMIT_PAGES`
    (`console.warn` ao truncar). Token **continua só no header**; o `Link` traz só URL pública.
- **`src/lib/github/sync.ts`** — linha 56-60: `since` passa a vir de
  `resolveSince(project.lastPolledAt, env.GITHUB_SYNC_OVERLAP_MS, new Date())`. Nada mais muda.
- **`src/lib/env.ts`** — `GITHUB_SYNC_OVERLAP_MS: z.coerce.number().int().min(0).default(300000)`.
- **`SPEC.md §7`** (paginação por `Link` + janela com overlap) e **§12** (env
  `GITHUB_SYNC_OVERLAP_MS`, default 300000=5min); **`PRD.md §8`** (nota de robustez).

### DOC.md (CLAUDE.md §2)
- **Alterar** `src/lib/github/DOC.md` (novo `cursor.ts`; paginação no `client.ts`; overlap no `sync.ts`).
- **Alterar** `src/lib/DOC.md` (nova var `GITHUB_SYNC_OVERLAP_MS`).

## Contratos

### `src/lib/github/cursor.ts`
```ts
// `since` da próxima janela de commits. lastPolledAt null (1º sync) → undefined (= histórico
// completo). Senão recua `overlapMs` (re-busca seguro: o dedupe por SHA descarta o que repetir).
// Puro: recebe `now` (não lê relógio) p/ ser testável.
export function resolveSince(
  lastPolledAt: Date | null,
  overlapMs: number,
  now: Date,
): string | undefined {
  if (lastPolledAt === null) return undefined;
  const floor = new Date(0);
  const since = new Date(lastPolledAt.getTime() - overlapMs);
  return (since < floor ? floor : since).toISOString();
}
```

### `src/lib/github/client.ts`
```ts
export const MAX_COMMIT_PAGES = 10; // teto: 10 × per_page(100) = 1000 commits/sync

// Extrai a URL de `rel="next"` do header Link do GitHub. Sem next → null.
// Ex.: '<https://api.github.com/...&page=2>; rel="next", <...&page=5>; rel="last"'
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    const m = part.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (m) return m[1] ?? null;
    void m;
  }
  return null;
}

// listCommits passa a paginar seguindo rel="next" até MAX_COMMIT_PAGES; warn ao truncar.
```

## Impacto em PRD/SPEC

- **SPEC §7 (GitHub):** `listCommits` pagina via `Link; rel="next"` (teto `MAX_COMMIT_PAGES=10`); a
  janela de polling usa `since = lastPolledAt − GITHUB_SYNC_OVERLAP_MS` (overlap idempotente).
- **SPEC §12 (Defaults/env):** `GITHUB_SYNC_OVERLAP_MS` (default 300000 = 5min; 0 = sem overlap).
- **PRD §8:** nota de que o polling não perde commits em rajada (>100) nem com data retroativa.

## Desenho dos testes (test_levels: [unit, integration])

**Por que estes níveis:** a lógica nova e não-trivial é (a) `resolveSince` (math do overlap) e
`parseNextLink` (parse) — **puros**, unit; (b) o laço de paginação do cliente real — unit contra
`fetch` **fake** (o GitHub é o único externo permitido como stub, §5.3, com fixtures no formato real
do header `Link`); (c) o efeito no sync (o `since` passado + idempotência sob overlap) — integração
com **Postgres real**. Sem e2e: não há rede real do GitHub e a UI não muda.

**Passo vermelho (§5.4):** os testes são escritos contra símbolos **ausentes** (`resolveSince`,
`parseNextLink`, `MAX_COMMIT_PAGES`) e contra o comportamento atual (cliente lê só a 1ª página; sync
passa `since` sem overlap) → falham antes da feature (TypeError / asserção de valor), nunca por typo.

### Unit — `tests/unit/github-cursor.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { resolveSince } from "@/lib/github/cursor";

describe("resolveSince", () => {
  it("1º sync (lastPolledAt null) → undefined (histórico completo)", () => {
    expect(resolveSince(null, 300_000, new Date("2026-06-21T00:00:00Z"))).toBeUndefined();
  });
  it("recua o overlap a partir do lastPolledAt", () => {
    const last = new Date("2026-06-21T12:00:00Z");
    // 5 min antes
    expect(resolveSince(last, 300_000, new Date())).toBe("2026-06-21T11:55:00.000Z");
  });
  it("overlap 0 → since = lastPolledAt exato", () => {
    const last = new Date("2026-06-21T12:00:00Z");
    expect(resolveSince(last, 0, new Date())).toBe("2026-06-21T12:00:00.000Z");
  });
  it("overlap maior que a época → clampa no epoch (não vira data negativa)", () => {
    const last = new Date("1970-01-01T00:01:00Z"); // 60s após epoch
    expect(resolveSince(last, 300_000, new Date())).toBe("1970-01-01T00:00:00.000Z");
  });
});
```

### Unit — `tests/unit/github-client-pagination.test.ts`
```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGitHubClient,
  MAX_COMMIT_PAGES,
  parseNextLink,
} from "@/lib/github/client";

afterEach(() => vi.restoreAllMocks());

function page(commits: { sha: string }[], next: string | null): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (next) headers.set("link", `<${next}>; rel="next"`);
  const body = commits.map((c) => ({
    sha: c.sha,
    html_url: `https://github.com/o/r/commit/${c.sha}`,
    commit: { message: "x", author: { name: "Ana", date: "2026-06-10T12:00:00Z" } },
    author: { login: "ana" },
    parents: [{ sha: "p" }],
  }));
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("parseNextLink", () => {
  it("extrai a URL do rel=next", () => {
    const h = '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"';
    expect(parseNextLink(h)).toBe("https://api.github.com/x?page=2");
  });
  it("sem rel=next → null", () => {
    expect(parseNextLink('<https://api.github.com/x?page=9>; rel="last"')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});

describe("listCommits paginado", () => {
  it("segue rel=next e concatena todas as páginas", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(page([{ sha: "a1" }, { sha: "a2" }], "https://api.github.com/next?page=2"))
      .mockResolvedValueOnce(page([{ sha: "a3" }], null));
    const gh = createGitHubClient("tok");
    const commits = await gh.listCommits({ owner: "o", repo: "r", sha: "main" });
    expect(commits.map((c) => c.sha)).toEqual(["a1", "a2", "a3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("trunca em MAX_COMMIT_PAGES e avisa (não varre infinito)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Sempre devolve um rel=next → laço só para pelo teto.
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      page([{ sha: "x" }], "https://api.github.com/next?page=99"),
    );
    const gh = createGitHubClient("tok");
    const commits = await gh.listCommits({ owner: "o", repo: "r" });
    expect(commits).toHaveLength(MAX_COMMIT_PAGES); // 1 commit por página, teto de páginas
    expect(warn).toHaveBeenCalled();
  });
});
```

### Integração — `tests/integration/sync-overlap.test.ts` (Postgres real)
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import type { GitHubClient } from "@/lib/github/client";
import { syncProject } from "@/lib/github/sync";
import { ghBranch, ghCommit, makeStubClient } from "../setup/github";

async function seedProject() {
  const owner = await db.user.create({
    data: { email: "owner-ovl@x.com", passwordHash: "x", role: "admin" },
  });
  return db.project.create({
    data: { userId: owner.id, name: "M", owner: "o", repo: "r" },
  });
}

/** Stub que registra o `since` recebido por listCommits (o makeStubClient padrão ignora args). */
function recordingClient(base: GitHubClient, sink: { since?: string }): GitHubClient {
  return {
    ...base,
    listCommits: async (input) => {
      sink.since = input.since;
      return base.listCommits(input);
    },
  };
}

it("2º sync chama listCommits com since recuado pelo overlap", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1")], branches: [ghBranch("main", "a1")], runs: [] }),
  );
  const after = await db.project.findUniqueOrThrow({ where: { id: project.id } });
  const sink: { since?: string } = {};
  await syncProject(
    project.id,
    recordingClient(
      makeStubClient({ defaultBranch: "main", commits: [], branches: [ghBranch("main", "a1")], runs: [] }),
      sink,
    ),
  );
  // since == lastPolledAt - GITHUB_SYNC_OVERLAP_MS (default 5min, env de teste)
  const expected = new Date(after.lastPolledAt!.getTime() - 300_000).toISOString();
  expect(sink.since).toBe(expected);
});

it("overlap re-traz commit já visto sem duplicar linha nem evento", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1")], branches: [ghBranch("main", "a1")], runs: [] }),
  );
  const commitsBefore = await db.commit.count({ where: { projectId: project.id } });
  const eventsBefore = await db.event.count({ where: { projectId: project.id } });
  // 2º sync devolve o MESMO a1 (simula a janela de overlap re-trazendo-o).
  const res = await syncProject(
    project.id,
    makeStubClient({ defaultBranch: "main", commits: [ghCommit("a1")], branches: [ghBranch("main", "a1")], runs: [] }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 0 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(commitsBefore);
  expect(await db.event.count({ where: { projectId: project.id } })).toBe(eventsBefore);
});
```

> `vitest.config.ts` precisa de `GITHUB_SYNC_OVERLAP_MS: "300000"` no bloco `test.env` (defensivo,
> p/ o cálculo do teste bater com o default mesmo se o ambiente exportar outro valor).

## Critérios de pronto

- [ ] Os 3 arquivos de teste vistos **vermelhos** (símbolos ausentes / `since` sem overlap / só 1ª
      página) → **verdes** sem alterar os testes; ordem §5.5 (unit → integração).
- [ ] Paginação: token nunca aparece em log/erro (segue só no header); `MAX_COMMIT_PAGES` com warn.
- [ ] `tsc --noEmit` e Biome limpos nos arquivos tocados.
- [ ] `DOC.md` (`src/lib/github`, `src/lib`) atualizados; SPEC §7/§12 e PRD §8 atualizados.
- [ ] Spec marcada `done` (atualizada se divergir).

## Fora de escopo

- Backfill dos commits já perdidos no passado por falta de paginação (020 corrige só daqui pra frente).
- Requests condicionais ETag/`If-Modified-Since` p/ poupar rate limit (segue fora, como na 018).
- Paginação de branches/runs (raramente passam de 100; pode virar task futura se necessário).
- Cursor por SHA/`lastSeenSha` em vez de data — overlap + dedupe já cobrem o caso sem reescrita.
