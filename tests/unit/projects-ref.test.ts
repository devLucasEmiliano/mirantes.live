import { describe, expect, it } from "vitest";
import { matchProjectRef } from "@/lib/projects/ref";

const P = (
  over: Partial<{ id: string; name: string; owner: string; repo: string }>,
) => ({
  id: over.id ?? "id",
  name: over.name ?? "n",
  owner: over.owner ?? "o",
  repo: over.repo ?? "r",
});

describe("matchProjectRef", () => {
  const projects = [
    P({
      id: "1",
      name: "Mirantes",
      owner: "devlucasemiliano",
      repo: "mirantes.live",
    }),
    P({ id: "2", name: "Outro", owner: "acme", repo: "site" }),
  ];
  it("owner/repo exato", () => {
    const r = matchProjectRef(projects, "devlucasemiliano/mirantes.live");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("repo sozinho", () => {
    const r = matchProjectRef(projects, "site");
    expect(r.ok && r.project.id).toBe("2");
  });
  it("name", () => {
    const r = matchProjectRef(projects, "Mirantes");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("case-insensitive + trim", () => {
    const r = matchProjectRef(projects, "  MIRANTES.LIVE ");
    expect(r.ok && r.project.id).toBe("1");
  });
  it("precedência: owner/repo vence name", () => {
    const tricky = [
      P({ id: "a", name: "x/y", owner: "o", repo: "r1" }),
      P({ id: "b", name: "ignored", owner: "x", repo: "y" }),
    ];
    const r = matchProjectRef(tricky, "x/y");
    expect(r.ok && r.project.id).toBe("b"); // casa owner/repo antes de name
  });
  it("nada casa → not_found", () => {
    expect(matchProjectRef(projects, "zzz")).toEqual({
      ok: false,
      error: "not_found",
    });
  });
  it("dois com o mesmo repo → ambiguous", () => {
    const dup = [P({ id: "1", repo: "dup" }), P({ id: "2", repo: "dup" })];
    const r = matchProjectRef(dup, "dup");
    expect(r.ok).toBe(false);
    if (!r.ok && r.error === "ambiguous")
      expect(r.matches.map((p) => p.id)).toEqual(["1", "2"]);
    else throw new Error("esperava ambiguous");
  });
});
