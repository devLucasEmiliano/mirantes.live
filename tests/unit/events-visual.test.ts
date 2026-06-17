import { describe, expect, it } from "vitest";
import { eventVisualKind } from "@/lib/events/visual";
import type { TimelineEvent } from "@/lib/types";

function ev(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "1",
    source: "commit",
    type: "commit.created",
    title: "t",
    createdAt: "2026-06-10T12:00:00.000Z",
    visibleToClient: true,
    ...over,
  };
}

describe("eventVisualKind (categoria por type, não por source)", () => {
  it("commit.created → commit", () =>
    expect(eventVisualKind(ev({ type: "commit.created" }))).toBe("commit"));
  it("commit.merged → merge", () =>
    expect(eventVisualKind(ev({ type: "commit.merged" }))).toBe("merge"));
  // Regressão do bug: ci.run tem source:"commit" mas NÃO pode cair no ícone de commit.
  it("ci.run → ci (não colide com commit)", () =>
    expect(eventVisualKind(ev({ type: "ci.run" }))).toBe("ci"));
  it("goal.completed → goal-completed", () =>
    expect(
      eventVisualKind(ev({ source: "goal", type: "goal.completed" })),
    ).toBe("goal-completed"));
  it("goal.created → goal-created", () =>
    expect(eventVisualKind(ev({ source: "goal", type: "goal.created" }))).toBe(
      "goal-created",
    ));
  it("incident.opened → incident-open", () =>
    expect(
      eventVisualKind(ev({ source: "incident", type: "incident.opened" })),
    ).toBe("incident-open"));
  it("incidente resolvido → incident-resolved", () =>
    expect(
      eventVisualKind(ev({ source: "incident", type: "incident.resolved" })),
    ).toBe("incident-resolved"));
  it("tipo desconhecido → generic", () =>
    expect(eventVisualKind(ev({ source: "goal", type: "goal.updated" }))).toBe(
      "generic",
    ));
});
