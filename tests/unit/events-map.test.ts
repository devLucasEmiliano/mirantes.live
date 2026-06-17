import { describe, expect, it } from "vitest";
import {
  commitToEvent,
  formatRunDuration,
  mergeTitle,
  runConclusionLabel,
  runToEvent,
  shouldEmitRunEvent,
} from "@/lib/events/emit";
import { ghRun } from "../setup/github";

describe("commitToEvent", () => {
  it("commit comum → commit.created (detail = autor · repo · branch)", () => {
    const committedAt = new Date("2026-06-10T12:00:00Z");
    const ev = commitToEvent("p1", "mirantes.live", "main", {
      sha: "a1",
      message: "feat: x",
      author: "Ana",
      isMerge: false,
      committedAt,
    });
    expect(ev).toEqual({
      source: "commit",
      type: "commit.created",
      refId: "a1",
      projectId: "p1",
      title: "feat: x",
      detail: "Ana · mirantes.live · main",
      visibleToClient: true,
      createdAt: committedAt,
    });
  });
  it("merge → commit.merged com título limpo", () => {
    const ev = commitToEvent("p1", "mirantes.live", "main", {
      sha: "m1",
      message: "Merge pull request #1 from o/feat",
      author: "Ana",
      isMerge: true,
      committedAt: new Date("2026-06-10T12:00:00Z"),
    });
    expect(ev.type).toBe("commit.merged");
    expect(ev.title).toBe("Merge do PR #1");
    expect(ev.detail).toBe("Ana · mirantes.live · main");
    expect(ev.refId).toBe("m1");
  });
});

describe("mergeTitle", () => {
  it("PR → 'Merge do PR #N'", () =>
    expect(mergeTitle("Merge pull request #5 from o/add-x-y")).toBe(
      "Merge do PR #5",
    ));
  it("branch into → seta", () =>
    expect(mergeTitle("Merge branch 'quemsomos' into main")).toBe(
      "Merge: 'quemsomos' → main",
    ));
  it("branch sem into", () =>
    expect(mergeTitle("Merge branch 'feat'")).toBe("Merge: 'feat'"));
  it("remote-tracking (tira refs/remotes/)", () =>
    expect(
      mergeTitle("Merge remote-tracking branch 'refs/remotes/origin/main'"),
    ).toBe("Merge: origin/main"));
  it("padrão desconhecido → mensagem crua", () =>
    expect(mergeTitle("Revert 'feat: x'")).toBe("Revert 'feat: x'"));
});

describe("runToEvent", () => {
  it("run em falha: título sem 'CI', detalhe branch · duração", () => {
    const run = ghRun(7, {
      name: "CI",
      run_number: 7,
      conclusion: "failure",
      head_branch: "main",
      run_started_at: "2026-06-10T12:00:00Z",
      updated_at: "2026-06-10T12:05:00Z",
    });
    const ev = runToEvent("p1", run);
    expect(ev.source).toBe("commit");
    expect(ev.type).toBe("ci.run");
    expect(ev.refId).toBe("7");
    expect(ev.title).toBe("CI #7 · falhou");
    expect(ev.detail).toBe("main · 5m");
    expect(ev.createdAt).toEqual(new Date("2026-06-10T12:05:00Z"));
  });
});

describe("formatRunDuration", () => {
  const d = (iso: string) => new Date(iso);
  it("segundos", () =>
    expect(
      formatRunDuration(d("2026-06-10T12:00:00Z"), d("2026-06-10T12:00:45Z")),
    ).toBe("45s"));
  it("min e seg", () =>
    expect(
      formatRunDuration(d("2026-06-10T12:00:00Z"), d("2026-06-10T12:01:23Z")),
    ).toBe("1m 23s"));
  it("min exato (sem segundos)", () =>
    expect(
      formatRunDuration(d("2026-06-10T12:00:00Z"), d("2026-06-10T12:05:00Z")),
    ).toBe("5m"));
  it("horas", () =>
    expect(
      formatRunDuration(d("2026-06-10T12:00:00Z"), d("2026-06-10T13:04:00Z")),
    ).toBe("1h 4m"));
  it("sem início → vazio", () =>
    expect(formatRunDuration(null, d("2026-06-10T12:00:00Z"))).toBe(""));
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
