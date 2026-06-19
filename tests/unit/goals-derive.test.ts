import { describe, expect, it } from "vitest";
import {
  applyWeight,
  computePercent,
  deriveProgress,
  deriveStatus,
  deriveTree,
  type GoalRow,
  isOverdue,
} from "@/lib/goals/derive";

describe("computePercent (X→Y, |Δ|, clamp)", () => {
  it("ascendente 0→20", () => {
    expect(computePercent(0, 20, 5)).toBe(25);
    expect(computePercent(0, 20, 10)).toBe(50);
  });
  it("descendente 20→0", () => {
    expect(computePercent(20, 0, 15)).toBe(25);
    expect(computePercent(20, 0, 0)).toBe(100);
  });
  it("overshoot clampa em 100", () =>
    expect(computePercent(0, 20, 25)).toBe(100));
  it("start===target: 100 se atingiu, senão 0", () => {
    expect(computePercent(5, 5, 5)).toBe(100);
    expect(computePercent(5, 5, 3)).toBe(0);
  });
});

describe("applyWeight (move na direção do alvo, clampa)", () => {
  it("ascendente soma e clampa no alvo", () => {
    expect(applyWeight(0, 20, 5, 5)).toBe(10);
    expect(applyWeight(0, 20, 18, 5)).toBe(20); // não passa de 20
  });
  it("descendente subtrai e clampa no alvo", () => {
    expect(applyWeight(20, 0, 8, 5)).toBe(3);
    expect(applyWeight(20, 0, 3, 5)).toBe(0); // não passa de 0
  });
});

describe("deriveProgress / deriveStatus (pai)", () => {
  it("média simples dos filhos", () =>
    expect(deriveProgress([0, 50, 100])).toBe(50));
  it("sem filhos → 0", () => expect(deriveProgress([])).toBe(0));
  it("todos done → done", () =>
    expect(deriveStatus(["done", "done"])).toBe("done"));
  it("todos todo → todo", () =>
    expect(deriveStatus(["todo", "todo"])).toBe("todo"));
  it("misto → in_progress", () => {
    expect(deriveStatus(["todo", "done"])).toBe("in_progress");
    expect(deriveStatus(["in_progress", "todo"])).toBe("in_progress");
  });
});

describe("isOverdue", () => {
  const now = new Date(2026, 5, 19, 12, 0);
  it("passado + não-done → true", () =>
    expect(isOverdue(new Date(2026, 5, 10), "todo", now)).toBe(true));
  it("passado + done → false", () =>
    expect(isOverdue(new Date(2026, 5, 10), "done", now)).toBe(false));
  it("futuro → false", () =>
    expect(isOverdue(new Date(2026, 6, 1), "todo", now)).toBe(false));
});

describe("deriveTree (bottom-up, profundidade 3)", () => {
  const due = new Date(2026, 11, 31);
  const leaf = (
    id: string,
    parentId: string | null,
    over: Partial<GoalRow>,
  ): GoalRow => ({
    id,
    parentId,
    shortCode: id,
    title: id,
    status: "todo",
    progress: 0,
    dueDate: due,
    startValue: null,
    targetValue: null,
    currentValue: null,
    position: 0,
    ...over,
  });
  it("deriva pai e avô a partir das folhas", () => {
    const now = new Date(2026, 5, 19);
    const rows: GoalRow[] = [
      leaf("g1", null, {}),
      leaf("g2", "g1", {}),
      leaf("g4", "g2", { startValue: 0, targetValue: 10, currentValue: 10 }), // 100% / done
      leaf("g5", "g2", { startValue: 0, targetValue: 10, currentValue: 0 }), // 0% / todo
      leaf("g3", "g1", { progress: 40, status: "in_progress" }), // manual
    ];
    const tree = deriveTree(rows, now);
    const g1 = tree.find((g) => g.id === "g1");
    const g2 = g1?.children.find((g) => g.id === "g2");
    const g4 = g2?.children.find((g) => g.id === "g4");
    expect(g4?.percent).toBe(100);
    expect(g4?.status).toBe("done");
    expect(g2?.progress).toBe(50); // média(100,0)
    expect(g2?.status).toBe("in_progress"); // misto done+todo
    expect(g2?.derived).toBe(true);
    expect(g1?.progress).toBe(45); // média(50,40)
    expect(g1?.status).toBe("in_progress");
    expect(g1?.derived).toBe(true);
  });
});
