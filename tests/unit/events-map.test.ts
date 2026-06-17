import { describe, expect, it } from "vitest";
import {
  commitToEvent,
  runConclusionLabel,
  runToEvent,
  shouldEmitRunEvent,
} from "@/lib/events/emit";
import { ghRun } from "../setup/github";

describe("commitToEvent", () => {
  it("mapeia um commit para evento commit.created", () => {
    const committedAt = new Date("2026-06-10T12:00:00Z");
    const ev = commitToEvent("p1", "mirantes.live", {
      sha: "a1",
      message: "feat: x",
      author: "Ana",
      committedAt,
    });
    expect(ev).toEqual({
      source: "commit",
      type: "commit.created",
      refId: "a1",
      projectId: "p1",
      title: "feat: x",
      detail: "Ana · mirantes.live",
      visibleToClient: true,
      createdAt: committedAt,
    });
  });
});

describe("runToEvent", () => {
  it("mapeia uma run concluída em falha", () => {
    const run = ghRun(7, {
      name: "CI",
      run_number: 7,
      conclusion: "failure",
      head_branch: "main",
      updated_at: "2026-06-10T12:05:00Z",
    });
    const ev = runToEvent("p1", run);
    expect(ev.source).toBe("commit");
    expect(ev.type).toBe("ci.run");
    expect(ev.refId).toBe("7");
    expect(ev.title).toBe("CI CI #7: falhou");
    expect(ev.detail).toBe("branch main");
    expect(ev.createdAt).toEqual(new Date("2026-06-10T12:05:00Z"));
  });
});

describe("shouldEmitRunEvent (emite só na transição p/ completed)", () => {
  it("run nova já completed → emite", () =>
    expect(shouldEmitRunEvent(null, { status: "completed" })).toBe(true));
  it("in_progress → completed → emite", () =>
    expect(
      shouldEmitRunEvent({ status: "in_progress" }, { status: "completed" }),
    ).toBe(true));
  it("completed → completed (re-sync) → não emite", () =>
    expect(
      shouldEmitRunEvent({ status: "completed" }, { status: "completed" }),
    ).toBe(false));
  it("ainda não concluída → não emite", () =>
    expect(shouldEmitRunEvent(null, { status: "in_progress" })).toBe(false));
});

describe("runConclusionLabel", () => {
  it("success", () =>
    expect(
      runConclusionLabel({ status: "completed", conclusion: "success" }),
    ).toBe("sucesso"));
  it("failure", () =>
    expect(
      runConclusionLabel({ status: "completed", conclusion: "failure" }),
    ).toBe("falhou"));
  it("cancelled", () =>
    expect(
      runConclusionLabel({ status: "completed", conclusion: "cancelled" }),
    ).toBe("cancelado"));
  it("sem conclusion → concluído", () =>
    expect(runConclusionLabel({ status: "completed", conclusion: null })).toBe(
      "concluído",
    ));
});
