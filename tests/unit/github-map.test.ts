import { describe, expect, it } from "vitest";
import {
  deriveRunStatus,
  isValidRepoSlug,
  mapCommit,
  summarizeCommitBatch,
} from "@/lib/github/map";

describe("mapCommit", () => {
  it("usa a 1ª linha da mensagem como subject", () => {
    const row = mapCommit({
      sha: "abc123",
      html_url: "https://github.com/x/y/commit/abc123",
      commit: {
        message: "feat: assunto\n\ncorpo",
        author: { name: "Ana", date: "2026-06-10T12:00:00Z" },
      },
      author: { login: "ana-gh" },
      parents: [{ sha: "p0" }],
    });
    expect(row.sha).toBe("abc123");
    expect(row.message).toBe("feat: assunto");
    expect(row.author).toBe("Ana");
    expect(row.isMerge).toBe(false);
    expect(row.committedAt).toEqual(new Date("2026-06-10T12:00:00Z"));
  });
  it("cai para login sem commit.author.name", () => {
    const row = mapCommit({
      sha: "def456",
      html_url: "https://github.com/x/y/commit/def456",
      commit: {
        message: "fix: algo",
        author: { name: null, date: "2026-06-11T09:30:00Z" },
      },
      author: { login: "ghost" },
      parents: [{ sha: "p0" }],
    });
    expect(row.author).toBe("ghost");
  });
  it("cai para 'desconhecido' sem nome nem login", () => {
    const row = mapCommit({
      sha: "000",
      html_url: "https://github.com/x/y/commit/000",
      commit: {
        message: "chore: x",
        author: { name: null, date: "2026-06-11T09:30:00Z" },
      },
      author: null,
      parents: [{ sha: "p0" }],
    });
    expect(row.author).toBe("desconhecido");
  });
  it("marca isMerge quando há 2+ parents", () => {
    const row = mapCommit({
      sha: "m1",
      html_url: "https://github.com/x/y/commit/m1",
      commit: {
        message: "Merge pull request #1 from o/feat",
        author: { name: "Ana", date: "2026-06-10T12:00:00Z" },
      },
      author: { login: "ana-gh" },
      parents: [{ sha: "a" }, { sha: "b" }],
    });
    expect(row.isMerge).toBe(true);
  });
});

describe("summarizeCommitBatch", () => {
  it("vazio p/ 0", () => expect(summarizeCommitBatch(0, "mirantes")).toBe(""));
  it("singular p/ 1", () =>
    expect(summarizeCommitBatch(1, "mirantes")).toBe("1 commit em mirantes"));
  it("plural p/ N", () =>
    expect(summarizeCommitBatch(5, "mirantes")).toBe("5 commits em mirantes"));
});

describe("deriveRunStatus", () => {
  it("success", () =>
    expect(
      deriveRunStatus({ status: "completed", conclusion: "success" }),
    ).toBe("success"));
  it("failure", () =>
    expect(
      deriveRunStatus({ status: "completed", conclusion: "failure" }),
    ).toBe("failure"));
  it("cancelled", () =>
    expect(
      deriveRunStatus({ status: "completed", conclusion: "cancelled" }),
    ).toBe("cancelled"));
  it("running", () =>
    expect(deriveRunStatus({ status: "in_progress", conclusion: null })).toBe(
      "running",
    ));
  it("queued", () =>
    expect(deriveRunStatus({ status: "queued", conclusion: null })).toBe(
      "queued",
    ));
  it("neutral", () =>
    expect(deriveRunStatus({ status: "completed", conclusion: null })).toBe(
      "neutral",
    ));
});

describe("isValidRepoSlug", () => {
  it("válido", () =>
    expect(isValidRepoSlug("devlucasemiliano", "mirantes.live")).toBe(true));
  it("vazio", () => expect(isValidRepoSlug("", "x")).toBe(false));
  it("espaço", () => expect(isValidRepoSlug("a b", "x")).toBe(false));
  it("barra", () => expect(isValidRepoSlug("ok", "na/me")).toBe(false));
  it("charset ._-", () => expect(isValidRepoSlug("a_.-", "B0")).toBe(true));
});
