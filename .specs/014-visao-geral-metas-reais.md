---
id: 014
title: Visão Geral (/dashboard) — metas e resumo reais (de-mock)
status: done        # draft | approved | tests-red | done
test_levels: [unit, e2e]
created: 2026-06-19
---

# 014 — Visão Geral puxando metas reais

## Contexto

A spec **013** migrou `/dashboard/metas` para metas **reais** (`listGoals(scope, selected?.id)`),
mas **deliberadamente deixou** a Visão Geral (`/dashboard`) no mock — registrado na própria 013
(§"Decisões/divergências", "dashboard/home (`GoalsList`) ainda usam mock — fora do escopo da 013").
Resultado visível: a página **Metas** mostra M-1/M-2 reais, mas a **Visão Geral** mostra as metas
fictícias de `mockGoals` ("Desenvolvimento do Backend" etc.) e os cards a partir de `mockSummary`.

Esta task **supera** essa deferral: a Visão Geral passa a derivar metas e resumo dos **mesmos**
dados reais que a página de Metas, mantendo o escopo por papel e o projeto selecionado (cookie).

## Objetivo

Em `src/app/dashboard/page.tsx`, substituir `mockGoals`/`mockSummary` (nas partes de **metas**) por
dados reais, espelhando exatamente a página de Metas:

- **Lista "Metas do Projeto"** (`GoalsList`) → `listGoals(scope, projectId).map(toGoalDTO)` (top-3).
- **Card "Progresso Total"** (ProgressRing) → `summary.totalProgress`.
- **Card "Metas Concluídas"** → `summary.done` / `summary.total` (e a barra proporcional).
- **Card "Em Andamento"** → `summary.inProgress` (e "X a fazer" = `summary.todo`, hoje hardcoded "2").
- **Card "Metas Atrasadas"** → `summary.overdue` e "próx. vencimento" = `summary.nextDueDate`.

**Fora do escopo (continua mock, são de outras specs):**
- `UptimePanel` e qualquer dado de monitoramento/saúde/latência (specs de monitoramento).
- Cards "Commits da Semana" e "Atividade Recente" **já** são reais (specs 008/012) — inalterados.

Nenhuma mudança contradiz PRD/SPEC: a Visão Geral é a home do dashboard e o PRD descreve seus cards
como reflexo do projeto; hoje só estavam pendentes de fiação.

## Arquivos a criar/alterar

- **Criar** `src/lib/goals/summary.ts` — util **puro** `summarizeGoals(goals: DerivedGoal[]): GoalsSummary`.
  Sem I/O; opera sobre a árvore derivada já calculada por `deriveTree`.
- **Alterar** `src/app/dashboard/page.tsx` — buscar metas reais (escopo + projeto selecionado),
  derivar `summary`, e remover os usos de `mockGoals`/`mockSummary`. Manter `UptimePanel` mock.
- **Criar** `tests/unit/goals-summary.test.ts` — cobertura de `summarizeGoals`.
- **Criar** `tests/e2e/visao-geral.spec.ts` — admin logado vê metas reais na home.
- **Atualizar** `DOC.md`: `src/lib/goals/DOC.md` (novo `summary.ts`), `src/app/dashboard/DOC.md`
  (page agora real), e a nota em `src/lib/DOC.md` que dizia "home ainda usa mock".
- **(Divergência, ver §Decisões) Alterar** `src/components/metas/goal-row.tsx` (prop `compact`) e
  `src/components/shared/goals-list.tsx` (passa `compact`) + seus `DOC.md` — correção de layout
  da coluna estreita da Visão Geral, não prevista no plano original.

## Mudanças de schema

Nenhuma. Reusa `Goal`/`DerivedGoal` da 013.

## Contrato do util (`summarizeGoals`)

```ts
import type { DerivedGoal } from "./derive";

export interface GoalsSummary {
  /** Contagem de TODOS os nós (pais + filhos) achatando a árvore — espelha o mock (18 = topo+filhos). */
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  /** Nós com overdue=true (data passada e status ≠ done). */
  overdue: number;
  /** % agregado: média (arredondada) dos `percent` das metas de TOPO; 0 se vazio. */
  totalProgress: number;
  /** Menor `dueDate` (ISO AAAA-MM-DD) entre nós com status ≠ done; null se não houver. */
  nextDueDate: string | null;
}
```

Decisões (abertas a ajuste na aprovação):
- **Contagem achata a árvore inteira** (pais derivados + folhas), coerente com os números do mock
  (`12/18`). Alternativa seria contar só folhas — se preferir, ajusto antes de implementar.
- **`totalProgress` = média das metas de topo** (igual ao comentário do `mockSummary.totalProgress`).
- **`nextDueDate`** olha qualquer meta não-concluída (inclui atrasadas), pega a menor data, formato
  ISO; a page formata para "D Mês" (reusa o padrão de `goal-row.tsx`) ou mostra "—" quando null.

## Desenho dos testes

### Unit — `tests/unit/goals-summary.test.ts` (Vitest)

Constrói árvores via `deriveTree` (fixtures `GoalRow`) para refletir derivação real, depois afirma o
resumo. Casos:

1. **Árvore vazia** → `{ total:0, done:0, inProgress:0, todo:0, overdue:0, totalProgress:0, nextDueDate:null }`.
2. **Tudo concluído** (pai + 2 filhos done, datas futuras) → `total:3, done:3`, resto 0,
   `totalProgress:100`, `nextDueDate:null` (nenhum não-done).
3. **Misto** (pai com filhos done + in_progress + todo; tudo futuro) → conta o pai (derivado
   `in_progress`) + 3 filhos = `total:4`; `done:1, inProgress:2 (pai+filho), todo:1`;
   `totalProgress` = `percent` do topo (média dos filhos); `nextDueDate` = menor data não-done.
4. **Atrasada** (1 folha de topo com data passada e status ≠ done) → `overdue:1`; `nextDueDate` é a
   menor data entre não-done (a própria atrasada se for a menor).

Passo vermelho: o arquivo `summary.ts` não existe → import falha → suíte vermelha antes da feature.

### E2E — `tests/e2e/visao-geral.spec.ts` (Playwright)

Usa o pré-seed de metas (`seed-metas.ts`: M-1 "Entregar login" 1/2 em progresso; M-2 "Publicar v1"
concluída — ambas de topo, projeto-vitrine do admin). Após login admin e indo a `/dashboard`:

- "Metas do Projeto" mostra **"Entregar login"** e **"M-1"** (dado real, não `mockGoals`).
- Card "Metas Concluídas" mostra **"1/2"** (M-2 done de 2 metas).
- (negativo) Não aparece **"Desenvolvimento do Backend"** (título exclusivo do mock).

Passo vermelho: hoje a home renderiza `mockGoals` → "Desenvolvimento do Backend" aparece e
"Entregar login" não → o teste falha antes da feature.

## Código dos testes (a confirmar no passo vermelho)

### `tests/unit/goals-summary.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { deriveTree, type GoalRow } from "@/lib/goals/derive";
import { summarizeGoals } from "@/lib/goals/summary";

const NOW = new Date("2026-06-19T00:00:00Z");
const FUT = new Date("2026-12-31");
const PAST = new Date("2026-01-01");

function row(p: Partial<GoalRow> & Pick<GoalRow, "id">): GoalRow {
  return {
    parentId: null,
    shortCode: `X-${p.id}`,
    title: p.id,
    status: "todo",
    progress: 0,
    dueDate: FUT,
    startValue: null,
    targetValue: null,
    currentValue: null,
    position: 0,
    ...p,
  };
}

describe("summarizeGoals", () => {
  it("árvore vazia → tudo zero e sem próxima data", () => {
    expect(summarizeGoals(deriveTree([], NOW))).toEqual({
      total: 0,
      done: 0,
      inProgress: 0,
      todo: 0,
      overdue: 0,
      totalProgress: 0,
      nextDueDate: null,
    });
  });

  it("tudo concluído (pai + 2 filhos) → done=total, progresso 100, sem próxima data", () => {
    const rows = [
      row({ id: "p", position: 1 }),
      row({ id: "c1", parentId: "p", status: "done", progress: 100, position: 1 }),
      row({ id: "c2", parentId: "p", status: "done", progress: 100, position: 2 }),
    ];
    const s = summarizeGoals(deriveTree(rows, NOW));
    expect(s.total).toBe(3);
    expect(s.done).toBe(3);
    expect(s.inProgress).toBe(0);
    expect(s.todo).toBe(0);
    expect(s.overdue).toBe(0);
    expect(s.totalProgress).toBe(100);
    expect(s.nextDueDate).toBeNull();
  });

  it("misto → conta pai derivado e filhos; progresso = média do topo; próxima data = menor não-done", () => {
    const rows = [
      row({ id: "p", position: 1 }),
      row({ id: "done", parentId: "p", status: "done", progress: 100, dueDate: new Date("2026-07-01"), position: 1 }),
      row({ id: "prog", parentId: "p", status: "in_progress", progress: 50, dueDate: new Date("2026-08-01"), position: 2 }),
      row({ id: "todo", parentId: "p", status: "todo", progress: 0, dueDate: new Date("2026-09-01"), position: 3 }),
    ];
    const s = summarizeGoals(deriveTree(rows, NOW));
    expect(s.total).toBe(4); // pai + 3 filhos
    expect(s.done).toBe(1);
    expect(s.inProgress).toBe(2); // pai derivado + filho
    expect(s.todo).toBe(1);
    expect(s.overdue).toBe(0);
    expect(s.totalProgress).toBe(50); // média dos filhos (100+50+0)/3 ≈ 50, e é o único topo
    expect(s.nextDueDate).toBe("2026-08-01"); // menor data entre não-done (prog < todo)
  });

  it("meta de topo atrasada conta em overdue e entra em nextDueDate", () => {
    const rows = [
      row({ id: "late", status: "in_progress", progress: 30, dueDate: PAST, position: 1 }),
      row({ id: "future", status: "todo", progress: 0, dueDate: FUT, position: 2 }),
    ];
    const s = summarizeGoals(deriveTree(rows, NOW));
    expect(s.overdue).toBe(1);
    expect(s.total).toBe(2);
    expect(s.nextDueDate).toBe("2026-01-01"); // a atrasada é a menor entre não-done
  });
});
```

### `tests/e2e/visao-geral.spec.ts`

```ts
import { expect, type Page, test } from "@playwright/test";

const ADMIN = { email: "admin@mirantes.live", password: "admin-dev-2026" };

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
}

test("Visão Geral mostra metas reais (não mock)", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard");
  await expect(page.getByText("Metas do Projeto")).toBeVisible();
  await expect(page.getByText("Entregar login")).toBeVisible();
  await expect(page.getByText("M-1")).toBeVisible();
  // Card "Metas Concluídas": 1 de 2 (M-2 done).
  await expect(page.getByText("1/2")).toBeVisible();
  // Não vaza título exclusivo do mock antigo.
  await expect(page.getByText("Desenvolvimento do Backend")).toHaveCount(0);
});
```

## Implementação prevista (após /clear)

`src/lib/goals/summary.ts` — achata a árvore, conta por status/overdue, média dos `percent` de topo,
menor `dueDate` não-done (ISO via `toISOString().slice(0,10)`, igual ao `dto.ts`).

`src/app/dashboard/page.tsx`:
- `const derived = await listGoals(scope, projectId);`
- `const summary = summarizeGoals(derived);`
- `const goals = derived.map(toGoalDTO);`
- ProgressRing `value={summary.totalProgress}`; Concluídas `{summary.done}/{summary.total}` (barra
  guardando `total === 0`); Em Andamento `{summary.inProgress}` + `{summary.todo} a fazer`;
  Atrasadas `{summary.overdue}` + próx. vencimento formatado de `summary.nextDueDate` (ou "—").
- `<GoalsList goals={goals.slice(0, 3)} />`.
- Remover imports de `mockGoals`/`mockSummary`.

## Decisões/divergências (registro vivo — §3.2)

1. **Contagem achata a árvore inteira** (pais derivados + folhas) — confirmado na aprovação.
   `totalProgress` = média dos `percent` de topo; `nextDueDate` = menor `dueDate` entre não-`done`.
2. **Correção de layout não prevista no plano (aprovada no chat):** ao fiar metas REAIS, os cards
   de meta X→Y (com `shortCode` + badge `current/target`) estouraram a coluna estreita (~368px) da
   Visão Geral, colapsando o título a `width:0` (`flex-1 truncate`). Fix: prop **`compact`** em
   `GoalRow` (off por padrão → página de Metas intacta) que oculta o badge X→Y e a barra de
   progresso; `GoalsList` (home) passa `compact`. **Arquivos extras tocados:**
   `src/components/metas/goal-row.tsx`, `src/components/shared/goals-list.tsx` e seus `DOC.md`.
3. **Seletor do e2e ajustado:** `getByText("M-1")` colidia (strict mode) com a mensagem de commit
   semeada "feat: tela de login (M-1)" no feed de atividade; passou a `getByText("M-1", { exact:
   true })` — mesma intenção (mira o `shortCode`), sem afrouxar o teste.
4. **`mockGoals`/`mockSummary` continuam usados pela home pública de vitrine** (`src/app/page.tsx`),
   fora do escopo da 014; nota em `src/lib/DOC.md` atualizada para refletir isso.

## Critérios de pronto

- [x] `summarizeGoals` puro e coberto (4 casos), visto **vermelho** antes da implementação
      (import faltando → suíte vermelha), depois verde (4/4).
- [x] E2E `visao-geral.spec.ts` verde (passou por dois vermelhos reais antes: título colapsado a
      0px e seletor ambíguo — ambos diagnosticados e corrigidos).
- [x] `/dashboard` mostra as mesmas metas que `/dashboard/metas` para o projeto selecionado.
- [x] Sem `mockGoals`/`mockSummary` na page (UptimePanel mock permanece, documentado).
- [x] `DOC.md` de `src/lib/goals`, `src/app/dashboard`, `src/components/metas`,
      `src/components/shared` e nota em `src/lib/DOC.md` atualizados.
- [x] Biome + tipos limpos; suíte completa unit/integração 179/179; e2e da Visão Geral verde.
- [x] Spec marcada `done` (atualizada com as divergências acima).
