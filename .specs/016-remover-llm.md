---
id: 016
title: Remover o classificador LLM — atribuição commit→meta 100% determinística
status: done         # draft | approved | tests-red | done
test_levels: [unit, integration]
created: 2026-06-21
---

# 016 — Remover o classificador LLM (manter a regra determinística)

## Objetivo

Remover por completo o **classificador LLM** commit→meta (spec 013), deixando a atribuição
automática **apenas determinística** (keyword `M-12` / `meta #12` → branch vinculada → vínculo
manual). O progresso de meta passa a mudar só por: **(a)** sync determinístico do GitHub,
**(b)** Claude Code via MCP, **(c)** edição manual na UI/REST. Sem runtime de LLM, sem env de
LLM, sem caminho `method:"llm"`.

> Comportamento de produto **não muda** na prática: o `LLM_CLASSIFIER_KIND` já tem default
> `none`, então a atribuição **já cai** no determinístico hoje. Esta spec apaga o caminho morto
> e fixa o comportamento. É a Task B do roadmap (`.claude/plans/...`).

## Contexto e justificativa

- `src/lib/goals/classifier.ts` implementa `CommitClassifier` (`createHttp/Mcp/Offline/Stub`,
  `resolveClassifier`). `src/lib/goals/attribution.ts:59-92` chama `classifier.classify()` e,
  se o LLM devolve candidato válido, usa `method:"llm"`; senão cai no `resolveDeterministic`.
- `src/lib/github/sync.ts` passa `opts?.classifier` adiante (injeção p/ teste).
- `src/lib/env.ts:31-38` declara 5 `LLM_CLASSIFIER_*`. `vitest.config.ts:33` fixa
  `LLM_CLASSIFIER_KIND:"none"`.
- O **resolver determinístico** (`src/lib/goals/resolver.ts`) é PURO e já é o fallback —
  permanece intacto. A idempotência (`applyWeightIdempotent`) e a derivação X→Y não mudam.

## Dependência de ordem (CLAUDE.md §5.5)

Independente. Não depende de nem bloqueia a Task C/D (tokens/MCP-cliente). Faseado:
unit (nenhum novo; só remoção) → integração (sync determinístico no Postgres real).

## Arquivos a criar / alterar

### Remover
- **Apagar `src/lib/goals/classifier.ts`** (arquivo inteiro).
- **Apagar `tests/unit/goals-classifier.test.ts`** (testava só o classificador).

### Alterar — domínio
- **`src/lib/goals/attribution.ts`**:
  - Remover `import { type CommitClassifier, resolveClassifier } from "./classifier"`.
  - Remover a interface `AttributeOptions` e o parâmetro `opts` (assinatura passa a
    `attributeCommits(projectId, newCommits)`).
  - Remover a chamada `classifier.classify(...)` e o ramo `method:"llm"`. O loop passa a:
    ```ts
    const hint = resolveDeterministic({ message, branch, isMerge }, { candidates, branchLinks });
    if (!hint) continue;                       // sem match determinístico → não atribui
    const { goalId, method } = hint;           // method ∈ "keyword"|"branch"|"manual"
    if (!leafIds.has(goalId)) continue;
    // aplica peso idempotente como hoje
    ```
  - `AttribMethod` passa a `"keyword" | "branch" | "manual"` (sem `"llm"`).
- **`src/lib/github/sync.ts`**:
  - Remover `import type { CommitClassifier }` e o campo `classifier` das opts de `syncProject`.
  - Chamar `attributeCommits(projectId, rows...)` sem `{ classifier }`.
  - **Manter** o `try/catch` que protege o sync (atribuição que falhe não derruba o sync).

### Alterar — config
- **`src/lib/env.ts`**: remover `LLM_CLASSIFIER_KIND`, `LLM_CLASSIFIER_BASE_URL`,
  `LLM_CLASSIFIER_MODEL`, `LLM_CLASSIFIER_API_KEY`, `LLM_CLASSIFIER_TIMEOUT_MS` (linhas 31-38).
- **`vitest.config.ts`**: remover `LLM_CLASSIFIER_KIND: "none"` (linha 33).

### Alterar — testes
- **`tests/integration/goals-attribution.test.ts`**: trocar a injeção de stub/offline por
  gatilhos determinísticos (keyword/branch). Código completo abaixo.

### DOC.md / docs (CLAUDE.md §2)
- **`src/lib/goals/DOC.md`** — remover `classifier.ts` e menção a "LLM plugável".
- **`src/lib/github/DOC.md`** — ajustar o gancho de atribuição (sem classifier nas opts).
- **`CLAUDE.md`** — remover o bullet "Classificador LLM commit→meta" da §0 (stack).
- **`.docs/SPEC.MD §13`** — remover a parte de LLM da atribuição; manter determinístico.
- **`.specs/013-*.md`** — nota de divergência: classificador LLM removido na 016.

## Mudanças de schema

Nenhuma. `commit_goal_links.method` continua existindo; só deixa de receber o valor `"llm"`.

## Impacto em PRD/SPEC

- **PRD**: inalterado (comportamento de produto idêntico).
- **SPEC §13**: atualizar a descrição da atribuição para "determinística (keyword → branch →
  manual)", sem LLM.

## Desenho dos testes

**Infra real (§5.3):** Postgres real na integração (sync de verdade, link real, evento real).
O GitHub é stubado com fixtures realistas (`makeStubClient`/`ghCommit`/`ghMerge`), como já é.
Não há mais "externo LLM" para stubar.

**Passo vermelho (§5.4) — DIVERGÊNCIA do plano original:** a premissa original ("enquanto
`classifier.ts` existir, a compilação/asserções quebram") estava **errada**: `syncProject.opts` e
`attributeCommits.opts` já eram **opcionais** e, com `LLM_CLASSIFIER_KIND="none"`, o classificador
já era `offline` → a atribuição **já caía** no `resolveDeterministic` hoje. Logo o teste reescrito
(sem `opts.classifier`, gatilhos keyword/branch) passa **verde** contra o código atual — não há red
behavioral, porque o comportamento é idêntico antes e depois da remoção.

O red legítimo veio do mecanismo **break-to-confirm** que a própria §5.4 prevê ("se a implementação
já existe, escrever o teste e confirmar que ele falharia sem a lógica correta — ex. quebrando
temporariamente a função"): com `resolveDeterministic` retornando `null` temporariamente, os 4
testes de atribuição (keyword/branch/alvo/double-sync) falharam com `expected 1 to be 0` (sem link,
sem mover `current_value`), e o 5º ("sem keyword nem branch → unassigned") permaneceu verde (controle
que prova que a suíte discrimina comportamento real). Restaurado o resolver → 5/5 verde.

Como o 1º goal de um projeto recebe `shortCode = M-1`, os testes usam a keyword `(M-1)` na
mensagem (ou uma branch vinculada) para forçar a atribuição determinística — substituindo o
antigo stub de LLM.

### Integração — `tests/integration/goals-attribution.test.ts` (reescrito)
```ts
import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { createGoal, linkBranch } from "@/lib/goals/service";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";
import { ghBranch, ghCommit, ghMerge, makeStubClient } from "../setup/github";

const ADMIN = { role: "admin" } as const;

async function seedProjectWithGoal(
  over: Partial<{ start: number; target: number }> = {},
) {
  const owner = await seedUser({ email: "owner@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: owner.id, name: "Mirantes", owner: "devlucasemiliano", repo: "mirantes.live",
  });
  if (!p.ok) throw new Error("setup");
  const g = await createGoal(ADMIN, {
    projectId: p.project.id, title: "Entregar login", dueDate: future(),
    startValue: over.start ?? 0, targetValue: over.target ?? 20, currentValue: over.start ?? 0,
  });
  if (!g.ok) throw new Error("goal");
  return { project: p.project, goal: g.goal };
}

it("keyword (M-1) atribui → cria link, move current_value, emite goal.updated", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "feat: tela de login (M-1)")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const link = await db.commitGoalLink.findFirstOrThrow({ where: { goalId: goal.id } });
  expect(link.method).toBe("keyword");
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(1);
  expect(await db.event.count({ where: { type: "goal.updated", refId: goal.id } })).toBe(1);
});

it("branch vinculada (merge cita o nome) atribui com peso de merge", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await linkBranch(ADMIN, goal.id, "feature-login");
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghMerge("m1", "Merge pull request #4 from o/feature-login")],
      branches: [ghBranch("main", "m1")],
      runs: [],
    }),
  );
  const link = await db.commitGoalLink.findFirstOrThrow({ where: { goalId: goal.id } });
  expect(link.method).toBe("branch");
  expect(link.weight).toBe(5); // merge
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(5);
});

it("atingir o alvo → done + goal.completed + completedAt", async () => {
  const { project, goal } = await seedProjectWithGoal({ start: 0, target: 1 });
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "feat: x (M-1)")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const after = await db.goal.findUniqueOrThrow({ where: { id: goal.id } });
  expect(after.currentValue).toBe(1);
  expect(after.status).toBe("done");
  expect(after.completedAt).not.toBeNull();
  expect(await db.event.count({ where: { type: "goal.completed", refId: goal.id } })).toBe(1);
});

it("double-sync não duplica (link e current_value estáveis; sem reemissão)", async () => {
  const { project, goal } = await seedProjectWithGoal();
  const client = makeStubClient({
    defaultBranch: "main",
    commits: [ghCommit("a1", "feat: login (M-1)")],
    branches: [ghBranch("main", "a1")],
    runs: [],
  });
  await syncProject(project.id, client);
  await syncProject(project.id, client);
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect((await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue).toBe(1);
  expect(await db.event.count({ where: { type: "goal.updated", refId: goal.id } })).toBe(1);
});

it("sem keyword nem branch → unassigned, sem link, mas commit.created é emitido", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "chore: bump deps")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(0);
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(1);
});
```
> Removidos da suíte: o teste "stub atribui" (virou o teste de keyword acima), "offline →
> fallback" (redundante; o caminho agora é sempre determinístico) e "classifier que lança não
> derruba o sync" (não há mais classifier). A robustez do sync continua coberta pelo `try/catch`
> mantido em `syncProject` e pelos demais testes de integração de sync.

## Critérios de pronto

- [x] `grep -ri "LLM_CLASSIFIER\|classifier\|resolveClassifier" src/` → **zero** código (só notas
      "removido na spec 016" nos comentários/DOC; `resolver.ts` não cita LLM como ativo).
- [x] Integração `goals-attribution.test.ts` verde (5/5; vista vermelha antes via break-to-confirm):
      keyword/branch atribuem; sem match → unassigned; alvo → done; double-sync idempotente.
- [x] `tests/unit/goals-classifier.test.ts` removido; suíte unit segue verde (143/143 unit+integ).
- [x] `tsc --noEmit` limpo (exit 0); Biome limpo nos arquivos tocados.
- [x] `DOC.md` (goals, github, lib, branch-link) + `CLAUDE.md` §0 + `SPEC §2.9/§5.6/§7/§env`
      atualizados; `.env.example` limpo; nota de divergência na `.specs/013`.
- [x] Spec marcada `done`.

## Divergências da implementação

1. **Red step (§"Desenho dos testes"):** a premissa original de red por quebra de compilação estava
   incorreta (`opts` já era opcional e o comportamento é idêntico antes/depois). O red legítimo veio
   do **break-to-confirm** da §5.4 (neutralizar `resolveDeterministic` → 4/5 testes falham; restaurar
   → 5/5). Aprovado no chat. Detalhado na seção "Passo vermelho".
2. **Escopo de docs ampliado:** além de `goals/DOC.md` e `github/DOC.md`, também tinham menção ao LLM
   `src/lib/DOC.md` e `src/app/api/goals/[id]/branch-link/DOC.md` (atualizados), e `.env.example`
   (bloco `LLM_CLASSIFIER_*` removido). O comentário-cabeçalho de `resolver.ts` foi ajustado (deixou
   de chamá-lo de "fallback do LLM" → "único caminho de atribuição").
3. **SPEC.md:** os pontos de LLM estavam em §2.9 (set de `method`), §5.6, §7 e na tabela de env —
   todos atualizados (não só "§13", que era a referência genérica do plano).

## Fora de escopo

- Remover/alterar o resolver determinístico (`resolver.ts`) — permanece.
- Tokens por usuário e MCP-cliente — são as Tasks C/D (specs 017/018).
- Tela de "confirmação manual" dedicada — fora; a edição manual já existe na UI/REST de metas.
