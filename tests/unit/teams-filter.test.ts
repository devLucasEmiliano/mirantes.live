import { describe, expect, it } from "vitest";
import {
  filterProjects,
  filterUsers,
  normalize,
  teamNameOf,
} from "@/lib/teams-filter";

const USERS = [
  { id: "u1", email: "renato@mirantes.live", name: "Renato Carvalho" },
  { id: "u2", email: "joao@mirantes.live", name: "João Silva" },
  { id: "u3", email: "semnome@mirantes.live", name: null },
];

const PROJECTS = [
  {
    id: "p1",
    name: "mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
    teamId: null,
  },
  {
    id: "p2",
    name: "api",
    owner: "devlucasemiliano",
    repo: "api",
    teamId: "t2",
  },
  {
    id: "p3",
    name: "segundo",
    owner: "devlucasemiliano",
    repo: "segundo-repo",
    teamId: "t1",
  },
];

const TEAMS = [
  { id: "t1", name: "Equipe QA" },
  { id: "t2", name: "Equipe Dev" },
];

describe("normalize", () => {
  it("baixa a caixa e remove acento", () => {
    expect(normalize("João SILVA")).toBe("joao silva");
    expect(normalize("Ção Ñ Ü")).toBe("cao n u");
  });
});

describe("filterUsers", () => {
  it("query vazia devolve todos os não-membros", () => {
    expect(filterUsers(USERS, [], "").map((u) => u.id)).toEqual([
      "u1",
      "u2",
      "u3",
    ]);
  });

  it("já-membro sai da lista mesmo casando a busca", () => {
    expect(filterUsers(USERS, ["u1"], "renato")).toEqual([]);
  });

  it("casa pelo email quando name é null", () => {
    expect(filterUsers(USERS, [], "semnome").map((u) => u.id)).toEqual(["u3"]);
  });

  it("é case-insensitive no nome", () => {
    expect(filterUsers(USERS, [], "renato").map((u) => u.id)).toEqual(["u1"]);
    expect(filterUsers(USERS, [], "CARVALHO").map((u) => u.id)).toEqual(["u1"]);
  });

  it("ignora acento nos dois lados da comparação", () => {
    expect(filterUsers(USERS, [], "joao").map((u) => u.id)).toEqual(["u2"]);
    expect(filterUsers(USERS, [], "João").map((u) => u.id)).toEqual(["u2"]);
  });

  it("busca sem resultado devolve lista vazia", () => {
    expect(filterUsers(USERS, [], "zzz")).toEqual([]);
  });
});

describe("filterProjects", () => {
  it("tira os projetos JÁ desta equipe", () => {
    expect(filterProjects(PROJECTS, "t1", "").map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
  });

  it("mantém projeto de OUTRA equipe (clicar move)", () => {
    expect(filterProjects(PROJECTS, "t1", "api").map((p) => p.id)).toEqual([
      "p2",
    ]);
  });

  it("casa por owner/repo, não só pelo repo", () => {
    expect(
      filterProjects(PROJECTS, "t1", "devlucasemiliano/api").map((p) => p.id),
    ).toEqual(["p2"]);
  });

  it("query vazia com todos já atribuídos devolve vazio", () => {
    expect(filterProjects([PROJECTS[2]], "t1", "")).toEqual([]);
  });
});

describe("teamNameOf", () => {
  it("devolve o nome quando o teamId existe", () => {
    expect(teamNameOf("t2", TEAMS)).toBe("Equipe Dev");
  });

  it("null quando sem equipe", () => {
    expect(teamNameOf(null, TEAMS)).toBeNull();
  });

  it("null quando o teamId é órfão", () => {
    expect(teamNameOf("inexistente", TEAMS)).toBeNull();
  });
});
