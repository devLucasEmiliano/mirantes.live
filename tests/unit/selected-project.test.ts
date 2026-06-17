import { describe, expect, it } from "vitest";
import { pickSelectedProject } from "@/lib/projects/select";

const projects = [
  { id: "p1", name: "Alpha" },
  { id: "p2", name: "Beta" },
];

describe("pickSelectedProject", () => {
  it("cookie válido → o projeto escolhido", () =>
    expect(pickSelectedProject(projects, "p2")).toEqual({
      id: "p2",
      name: "Beta",
    }));
  it("cookie de projeto alheio/inexistente → fallback p/ o mais antigo", () =>
    expect(pickSelectedProject(projects, "zzz")).toEqual({
      id: "p1",
      name: "Alpha",
    }));
  it("sem cookie → fallback p/ o mais antigo", () =>
    expect(pickSelectedProject(projects, null)).toEqual({
      id: "p1",
      name: "Alpha",
    }));
  it("sem projetos → null", () =>
    expect(pickSelectedProject([], "p1")).toBeNull());
});
