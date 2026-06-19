import { describe, expect, it } from "vitest";
import { goalToEvent } from "@/lib/goals/emit";

const at = new Date("2026-06-15T10:00:00Z");
const goal = {
  id: "g1",
  projectId: "p1",
  shortCode: "M-1",
  title: "Entregar login",
  currentValue: 10,
  targetValue: 20,
};

describe("goalToEvent", () => {
  it("updated → goal.updated com detail current/target", () => {
    expect(goalToEvent(goal, "updated", at)).toEqual({
      source: "goal",
      type: "goal.updated",
      refId: "g1",
      projectId: "p1",
      title: "Entregar login",
      detail: "M-1 · 10/20",
      visibleToClient: true,
      createdAt: at,
    });
  });
  it("completed → goal.completed", () => {
    const ev = goalToEvent({ ...goal, currentValue: 20 }, "completed", at);
    expect(ev.type).toBe("goal.completed");
    expect(ev.detail).toBe("M-1 · concluída");
  });
  it("created/archived mantêm refId e título", () => {
    expect(goalToEvent(goal, "created", at).type).toBe("goal.created");
    expect(goalToEvent(goal, "archived", at).type).toBe("goal.archived");
  });
});
