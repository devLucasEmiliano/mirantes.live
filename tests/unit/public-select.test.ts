import { describe, expect, it } from "vitest";
import { pickPublicProject, publicSlug } from "@/lib/projects/public-select";

const P = (
  over: Partial<{ id: string; name: string; owner: string; repo: string }>,
) => ({
  id: over.id ?? "id",
  name: over.name ?? "n",
  owner: over.owner ?? "o",
  repo: over.repo ?? "r",
});

describe("publicSlug", () => {
  it("usa owner/repo", () => {
    expect(publicSlug(P({ owner: "acme", repo: "site" }))).toBe("acme/site");
  });
});

describe("pickPublicProject", () => {
  const projects = [
    P({
      id: "1",
      name: "Mirantes",
      owner: "devlucasemiliano",
      repo: "mirantes.live",
    }), // mais antigo
    P({ id: "2", name: "Outro", owner: "acme", repo: "site" }),
  ];

  it("URL (match único) vence o cookie", () => {
    const r = pickPublicProject(projects, "acme/site", "1");
    expect(r?.id).toBe("2");
  });
  it("URL por repo sozinho casa", () => {
    expect(pickPublicProject(projects, "mirantes.live", null)?.id).toBe("1");
  });
  it("URL ambígua → cai pro cookie", () => {
    const dup = [P({ id: "1", repo: "dup" }), P({ id: "2", repo: "dup" })];
    expect(pickPublicProject(dup, "dup", "2")?.id).toBe("2");
  });
  it("URL não encontrada → cai pro cookie", () => {
    expect(pickPublicProject(projects, "zzz", "2")?.id).toBe("2");
  });
  it("sem URL, cookie válido → cookie", () => {
    expect(pickPublicProject(projects, null, "2")?.id).toBe("2");
  });
  it("cookie inválido → mais antigo (primeiro)", () => {
    expect(pickPublicProject(projects, null, "999")?.id).toBe("1");
  });
  it("sem URL nem cookie → mais antigo", () => {
    expect(pickPublicProject(projects, null, null)?.id).toBe("1");
  });
  it("lista vazia → null", () => {
    expect(pickPublicProject([], "qualquer", "x")).toBeNull();
  });
});
