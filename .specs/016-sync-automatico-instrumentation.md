---
id: 016
title: Sincronização automática de projetos — auto-start via instrumentation + intervalo por env
status: done         # draft | approved | tests-red | done
test_levels: [unit]
created: 2026-06-21
---

# 016 — Sync automático de projetos (auto-start no boot + intervalo seguro por env)

## Objetivo

Hoje os projetos **não sincronizam sozinhos**: o worker existe (`src/lib/github/worker.ts`,
`runGitHubSyncLoop`) mas nada o liga ao app — `dev` é só `next dev` (package.json:6) e o loop só
roda se alguém executar **manualmente** `bun run worker:github` num terminal à parte. Na prática os
dados só atualizam ao clicar "Sincronizar Agora" (`POST /api/projects/[id]/sync`).

Esta task faz o loop **arrancar junto com o app** (via `instrumentation.ts`, runtime nodejs),
reusando o mesmo núcleo `syncProject`, com **intervalo configurável por env** (default seguro de
60s) e guardas contra runtime Edge, duplo start e e2e.

Decidido com o humano (AskUserQuestion): disparo **junto com o app** (instrumentation) + intervalo
**60s configurável por env**.

## Contexto e justificativa

- `runGitHubSyncLoop({ intervalMs = DEFAULT_INTERVAL_MS })` já itera `db.project.findMany` →
  `syncProject` por projeto, sobrevive a erro por-projeto e encerra em SIGINT/SIGTERM
  (worker.ts:18–64). Falta só **dispará-lo** sem terminal extra.
- O SPEC §1 já permite: *"Os workers podem rodar no mesmo container (processo Node com schedulers)
  ou separados"*. `instrumentation.ts` é exatamente o "mesmo container" — não contradiz o SPEC,
  só explicita o mecanismo de boot.
- **Rate limit:** cada `syncProject` faz **4 chamadas REST** (`getRepo` + `listCommits` +
  `listBranches` + `listWorkflowRuns`, sync.ts:55–114). Limite autenticado = **5000 req/h por token
  do dono** (projetos do mesmo dono dividem o orçamento).
  - 60s → 60 ciclos/h × 4 = **240 req/h por projeto** (folga até ~20 projetos/dono).
  - 30s → **480 req/h por projeto** (ok p/ poucos; aperta perto de ~10).
  Por isso o intervalo vira env e há um **piso de segurança** (15s) que impede despencar o intervalo
  por engano.
- Next 16 `instrumentation.ts` (lido em `node_modules/next/dist/docs/.../instrumentation.md`):
  `register()` roda **1× por instância** e **bloqueia o boot até resolver** → **não** se dá `await`
  no loop infinito; é fire-and-forget. Funciona em nodejs **e** Edge → guardar por
  `process.env.NEXT_RUNTIME` e usar `import()` dinâmico p/ não carregar Prisma no bundle Edge.

## Dependência de ordem (CLAUDE.md §5.5)

Depende só do núcleo `syncProject` (já verde desde a 008/013). `worker.ts`/`instrumentation.ts` são
glue fino (o SPEC mantém `worker.ts` fora de `test_levels`); o que se testa são os **helpers puros**
extraídos. Sem integração/e2e nova (não há rede real do GitHub em teste; o núcleo já é coberto).

## Arquivos a criar / alterar

### Criar
- **`src/instrumentation.ts`** — `register()` (ver Contratos). Guarda runtime → `import()` dinâmico
  de `env` e `worker` → `shouldAutostart` → `startGitHubSyncLoopOnce()`.

### Alterar
- **`src/lib/env.ts`** — adicionar ao schema:
  - `GITHUB_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(60000)`
  - `GITHUB_SYNC_AUTOSTART: z.enum(["0", "1"]).default("1")`
- **`src/lib/github/worker.ts`**:
  - `DEFAULT_INTERVAL_MS` deixa de ser literal e passa a `env.GITHUB_SYNC_INTERVAL_MS`.
  - Extrair helpers **puros** (alvo unit): `resolveSyncInterval(raw, fallback, floor?)` e
    `shouldAutostart(runtime, flag)`.
  - `runGitHubSyncLoop` usa `resolveSyncInterval(opts.intervalMs, env.GITHUB_SYNC_INTERVAL_MS)`.
  - Novo `startGitHubSyncLoopOnce()` — guarda de instância única via `Symbol.for` em `globalThis`
    (HMR do dev pode reimportar); dispara `runGitHubSyncLoop()` sem `await`, loga erro.
  - Bloco `import.meta.main` (worker standalone) **inalterado** — continua `runGitHubSyncLoop()`.
- **`playwright.config.ts`** — adicionar `GITHUB_SYNC_AUTOSTART: "0"` ao `webEnv` (o e2e sobe
  `bun run dev`; sem isso o loop arrancaria no meio dos testes).
- **`vitest.config.ts`** — adicionar `GITHUB_SYNC_AUTOSTART: "0"` ao bloco `test.env` (defensivo;
  nada importa `instrumentation` no vitest, mas deixa explícito).
- **`PRD.md` / `SPEC.md`** — registrar autostart via instrumentation (SPEC §1/§7) e o default do
  intervalo do github-sync (60s, `GITHUB_SYNC_INTERVAL_MS`) na tabela de defaults §12; documentar
  `GITHUB_SYNC_AUTOSTART` em §11 (env).

### DOC.md (CLAUDE.md §2)
- **Criar/alterar** `src/DOC.md` (novo `instrumentation.ts`).
- **Alterar** `src/lib/github/DOC.md` (helpers + autostart + interval por env no `worker.ts`).
- **Alterar** `src/lib/DOC.md` (novas vars `GITHUB_SYNC_INTERVAL_MS`/`GITHUB_SYNC_AUTOSTART`).

### Testes
- **Criar** `tests/unit/github-sync-interval.test.ts`.

## Contratos

### `src/lib/github/worker.ts` (helpers puros)
```ts
// Piso p/ não despencar o intervalo por engano e estourar o rate limit do GitHub.
export const MIN_INTERVAL_MS = 15_000;

// raw = override de runGitHubSyncLoop({intervalMs}); fallback = env.GITHUB_SYNC_INTERVAL_MS.
// undefined / NaN / <=0 → fallback. Senão clampa no piso. Puro (sem ler env aqui).
export function resolveSyncInterval(
  raw: number | undefined,
  fallback: number,
  floor = MIN_INTERVAL_MS,
): number {
  if (raw === undefined || !Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.max(floor, raw);
}

// Liga o loop só no runtime Node do Next e com o flag "1". Puro.
export function shouldAutostart(runtime: string | undefined, flag: string): boolean {
  return runtime === "nodejs" && flag === "1";
}

// Guarda de instância única (globalThis sobrevive ao HMR do dev). Fire-and-forget.
export function startGitHubSyncLoopOnce(): void { /* Symbol.for guard + void runGitHubSyncLoop().catch */ }
```

### `src/instrumentation.ts`
```ts
// register() roda 1× no boot (Next 16). Edge sai cedo (sem carregar Prisma); só Node liga o loop.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("@/lib/env");
  const { shouldAutostart, startGitHubSyncLoopOnce } = await import("@/lib/github/worker");
  if (!shouldAutostart(process.env.NEXT_RUNTIME, env.GITHUB_SYNC_AUTOSTART)) return;
  startGitHubSyncLoopOnce();
}
```

## Impacto em PRD/SPEC

- **SPEC §1 (Processos)** e **§7 (GitHub)**: o worker de GitHub é iniciado no boot do app via
  `src/instrumentation.ts` (mesmo container), além do modo standalone `worker:github`.
- **SPEC §12 (Defaults/env)**: `GITHUB_SYNC_INTERVAL_MS` (default 60000, piso 15s — era 5min só no
  código) e `GITHUB_SYNC_AUTOSTART` (default "1"; "0" desliga — e2e/vitest/standalone). _Divergência:_
  o plano citava "§11 (env)", mas §11 da SPEC é **Segurança**; a tabela de env/defaults é a **§12** —
  ambas as vars foram documentadas lá.
- **PRD §8**: nota de que o polling roda automaticamente ao subir o app (sem terminal extra).

## Desenho dos testes (test_levels: [unit])

**Por que só unit:** o núcleo `syncProject` (que faz I/O real) já é coberto pelas specs 008/013 com
Postgres real; `worker.ts`/`instrumentation.ts` são glue fino (SPEC tira `worker.ts` de test_levels).
O comportamento **novo e não-trivial** é a regra de resolução de intervalo (default/clamp/piso) e a
decisão de autostart — ambos **puros**, testáveis sem infra. Sem teste "de mentira": asserções sobre
valores concretos, e o piso é provado quebrando o intervalo abaixo dele.

**Passo vermelho (§5.4):** _divergência do plano original_ — a sentinela `shouldAutostart → false`
deixaria os 3 casos que esperam `false` **passando** no estágio vermelho (uma constante não pode
falhar em todos os casos booleanos), violando "todo teste visto falhando". Em vez disso, o teste foi
escrito contra as funções **ausentes**: rodado sem nenhum helper em `worker.ts`, os **8 casos**
falham com `TypeError: ... is not a function` / `MIN_INTERVAL_MS` undefined (feature ausente, não
typo) — vermelho real e completo. Depois implementar a lógica até verde, sem tocar nos testes.

### Unit — `tests/unit/github-sync-interval.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  MIN_INTERVAL_MS,
  resolveSyncInterval,
  shouldAutostart,
} from "@/lib/github/worker";

describe("resolveSyncInterval", () => {
  it("ausente → usa o fallback (default 60s)", () => {
    expect(resolveSyncInterval(undefined, 60_000)).toBe(60_000);
  });
  it("valor válido acima do piso → respeita", () => {
    expect(resolveSyncInterval(120_000, 60_000)).toBe(120_000);
  });
  it("abaixo do piso → clampa no piso (segurança de rate limit)", () => {
    expect(resolveSyncInterval(5_000, 60_000)).toBe(MIN_INTERVAL_MS);
    expect(MIN_INTERVAL_MS).toBe(15_000);
  });
  it("não-positivo / NaN → cai no fallback", () => {
    expect(resolveSyncInterval(0, 60_000)).toBe(60_000);
    expect(resolveSyncInterval(-1, 60_000)).toBe(60_000);
    expect(resolveSyncInterval(Number.NaN, 60_000)).toBe(60_000);
  });
});

describe("shouldAutostart", () => {
  it("nodejs + '1' → liga", () => {
    expect(shouldAutostart("nodejs", "1")).toBe(true);
  });
  it("edge + '1' → não liga (Prisma/sockets não vão no Edge)", () => {
    expect(shouldAutostart("edge", "1")).toBe(false);
  });
  it("runtime indefinido → não liga", () => {
    expect(shouldAutostart(undefined, "1")).toBe(false);
  });
  it("nodejs + '0' → desligado (e2e/standalone)", () => {
    expect(shouldAutostart("nodejs", "0")).toBe(false);
  });
});
```

## Critérios de pronto

- [x] `tests/unit/github-sync-interval.test.ts` visto **vermelho** (8 casos, funções ausentes →
      `TypeError`) → **verde** (8/8) sem alterar o teste; ordem §5.5 respeitada (unit).
- [x] `GITHUB_SYNC_AUTOSTART=0` → loop **não** arranca: garantido pelo puro `shouldAutostart`
      (caso `nodejs + "0" → false`, unit verde) + flag "0" no vitest/playwright.
- [x] e2e (`test:e2e`) não dispara o loop (webEnv com `GITHUB_SYNC_AUTOSTART="0"`).
- [x] `tsc --noEmit` limpo; Biome limpo nos arquivos tocados (line-endings normalizados p/ LF);
      `DOC.md` atualizados (criado `src/DOC.md`; `src/lib/github/DOC.md`, `src/lib/DOC.md`); SPEC
      §§1/7/12 e PRD §8 atualizados.
- [x] Spec marcada `done` (atualizada nas divergências: red sem sentinelas; env em §12, não §11).
- [ ] **Manual, não executado pelo agente:** subir `bun run dev` e ver
      `"[github-sync] worker iniciado (intervalo 60s)"` + `last_polled_at` avançando. **Não rodei** —
      boot do dev dispara **sync real contra a API do GitHub** (ação outward-facing, sobre o banco de
      dev). A fiação está coberta por unit + tipos; rodar fica a critério do humano.

## Fora de escopo

- Requests condicionais (ETag/`If-Modified-Since`) p/ poupar rate limit em 304 — otimização futura.
- Backoff/retry em 429 ou parsing de headers `X-RateLimit-*` (segue "fora de escopo" da 008).
- Intervalo por-projeto ou por-dono (um intervalo global basta agora).
- Agendar via cron externo / fila — instrumentation cobre o caso "mesmo container".
```
