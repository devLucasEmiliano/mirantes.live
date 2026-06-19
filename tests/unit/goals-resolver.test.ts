import { describe, expect, it } from "vitest";
import { type CandidateGoal, resolveDeterministic } from "@/lib/goals/resolver";

const candidates: CandidateGoal[] = [
  { id: "goal-12", shortCode: "M-12", title: "Login" },
  { id: "goal-3", shortCode: "M-3", title: "Pagamentos" },
];

describe("resolveDeterministic", () => {
  it("keyword M-12 no message → goal-12", () => {
    const m = resolveDeterministic(
      { message: "feat: oauth (M-12)", branch: "main", isMerge: false },
      { candidates, branchLinks: [] },
    );
    expect(m).toEqual({ goalId: "goal-12", method: "keyword" });
  });
  it("keyword 'meta #3' → goal-3", () => {
    const m = resolveDeterministic(
      { message: "fix: meta #3 corrige taxa", branch: "main", isMerge: false },
      { candidates, branchLinks: [] },
    );
    expect(m?.goalId).toBe("goal-3");
  });
  it("branch: merge cujo título inclui a branch vinculada", () => {
    const m = resolveDeterministic(
      {
        message: "Merge pull request #9 from o/feature-login",
        branch: "main",
        isMerge: true,
      },
      {
        candidates,
        branchLinks: [{ branchName: "feature-login", goalId: "goal-12" }],
      },
    );
    expect(m).toEqual({ goalId: "goal-12", method: "branch" });
  });
  it("manual quando passado e sem keyword/branch", () => {
    const m = resolveDeterministic(
      { message: "chore: nada", branch: "main", isMerge: false },
      { candidates, branchLinks: [], manualGoalId: "goal-3" },
    );
    expect(m).toEqual({ goalId: "goal-3", method: "manual" });
  });
  it("precedência keyword > branch > manual", () => {
    const m = resolveDeterministic(
      { message: "feat (M-3) merge", branch: "main", isMerge: true },
      {
        candidates,
        branchLinks: [{ branchName: "main", goalId: "goal-12" }],
        manualGoalId: "goal-12",
      },
    );
    expect(m?.method).toBe("keyword");
    expect(m?.goalId).toBe("goal-3");
  });
  it("nada casa → null", () => {
    expect(
      resolveDeterministic(
        { message: "chore: bump", branch: "main", isMerge: false },
        { candidates, branchLinks: [] },
      ),
    ).toBeNull();
  });
});
