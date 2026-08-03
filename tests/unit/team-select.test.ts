import { describe, expect, it } from "vitest";
import { pickTeamProject } from "@/lib/goals/team-select";

const P = (id: string) => ({ id });

describe("pickTeamProject (puro)", () => {
  it("cookie casa um projeto da lista → esse", () => {
    const projects = [P("a"), P("b")];
    expect(pickTeamProject(projects, "b")).toEqual(P("b"));
  });

  it("cookie ausente/alheio → primeiro da lista (fallback)", () => {
    const projects = [P("a"), P("b")];
    expect(pickTeamProject(projects, undefined)).toEqual(P("a"));
    expect(pickTeamProject(projects, "alheio")).toEqual(P("a"));
  });

  it("lista vazia → null, mesmo com cookie", () => {
    expect(pickTeamProject([], "a")).toBeNull();
  });
});
