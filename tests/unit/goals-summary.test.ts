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
      row({
        id: "c1",
        parentId: "p",
        status: "done",
        progress: 100,
        position: 1,
      }),
      row({
        id: "c2",
        parentId: "p",
        status: "done",
        progress: 100,
        position: 2,
      }),
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
      row({
        id: "done",
        parentId: "p",
        status: "done",
        progress: 100,
        dueDate: new Date("2026-07-01"),
        position: 1,
      }),
      row({
        id: "prog",
        parentId: "p",
        status: "in_progress",
        progress: 50,
        dueDate: new Date("2026-08-01"),
        position: 2,
      }),
      row({
        id: "todo",
        parentId: "p",
        status: "todo",
        progress: 0,
        dueDate: new Date("2026-09-01"),
        position: 3,
      }),
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
      row({
        id: "late",
        status: "in_progress",
        progress: 30,
        dueDate: PAST,
        position: 1,
      }),
      row({
        id: "future",
        status: "todo",
        progress: 0,
        dueDate: FUT,
        position: 2,
      }),
    ];
    const s = summarizeGoals(deriveTree(rows, NOW));
    expect(s.overdue).toBe(1);
    expect(s.total).toBe(2);
    expect(s.nextDueDate).toBe("2026-01-01"); // a atrasada é a menor entre não-done
  });
});
