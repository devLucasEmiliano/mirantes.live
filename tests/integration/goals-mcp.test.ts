import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  metasArchive,
  metasCreate,
  metasLinkCommit,
  metasList,
  metasProjects,
  metasUpdate,
} from "@/lib/mcp/tools";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;

it("metasCreate + metasList refletem o service (escopo admin)", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: "r",
  });
  if (!p.ok) throw new Error("setup");
  const created = await metasCreate(ADMIN, {
    projectId: p.project.id,
    title: "Via MCP",
    dueDate: future().toISOString(),
  });
  expect(created.shortCode).toBe("M-1");
  const list = await metasList(ADMIN, { projectId: p.project.id });
  expect(list.map((g) => g.title)).toContain("Via MCP");
});

it("metasLinkCommit é idempotente", async () => {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: "r",
  });
  if (!p.ok) throw new Error("setup");
  const meta = await metasCreate(ADMIN, {
    projectId: p.project.id,
    title: "M",
    dueDate: future().toISOString(),
    targetValue: 5,
    startValue: 0,
  });
  const commit = await db.commit.create({
    data: {
      projectId: p.project.id,
      sha: "z1",
      message: "x",
      author: "Ana",
      committedAt: new Date(),
    },
  });
  await metasLinkCommit(ADMIN, { goalId: meta.id, commitSha: "z1" });
  await metasLinkCommit(ADMIN, { goalId: meta.id, commitSha: "z1" });
  expect(
    await db.commitGoalLink.count({
      where: { goalId: meta.id, commitId: commit.id },
    }),
  ).toBe(1);
});

// --- Spec 015: referência por ref de projeto / short code / descoberta -------------------

async function twoProjects() {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const a = await createProject({
    userId: u.id,
    name: "Mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
  });
  const b = await createProject({
    userId: u.id,
    name: "Outro",
    owner: "acme",
    repo: "site",
  });
  if (!a.ok || !b.ok) throw new Error("setup");
  return { mirantes: a.project, outro: b.project };
}

it("metasCreate por ref de projeto (sem UUID) cria no projeto certo", async () => {
  const { mirantes } = await twoProjects();
  const g = await metasCreate(ADMIN, {
    project: "mirantes.live",
    title: "Via ref",
    dueDate: future().toISOString(),
  });
  expect(g.projectId).toBe(mirantes.id);
  expect(g.shortCode).toBe("M-1");
});

it("metasList por ref retorna só as metas daquele projeto", async () => {
  const { mirantes, outro } = await twoProjects();
  await metasCreate(ADMIN, {
    project: "mirantes.live",
    title: "do mirantes",
    dueDate: future().toISOString(),
  });
  await metasCreate(ADMIN, {
    project: "acme/site",
    title: "do outro",
    dueDate: future().toISOString(),
  });
  const list = await metasList(ADMIN, { project: "mirantes.live" });
  expect(list.map((m) => m.title)).toEqual(["do mirantes"]);
  expect(list.every((m) => m.projectId === mirantes.id)).toBe(true);
  expect(outro.id).not.toBe(mirantes.id);
});

it("metasUpdate por shortCode + project muda a meta certa", async () => {
  await twoProjects();
  await metasCreate(ADMIN, {
    project: "mirantes.live",
    title: "M1",
    dueDate: future().toISOString(),
  });
  const updated = await metasUpdate(ADMIN, {
    project: "mirantes.live",
    shortCode: "M-1",
    status: "in_progress",
  });
  expect(updated.status).toBe("in_progress");
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: updated.id } })).status,
  ).toBe("in_progress");
});

it("metasArchive por shortCode arquiva e some do list", async () => {
  await twoProjects();
  await metasCreate(ADMIN, {
    project: "mirantes.live",
    title: "a arquivar",
    dueDate: future().toISOString(),
  });
  await metasArchive(ADMIN, { project: "mirantes.live", shortCode: "M-1" });
  expect(await metasList(ADMIN, { project: "mirantes.live" })).toHaveLength(0);
});

it("metasProjects lista os projetos do escopo", async () => {
  const { mirantes } = await twoProjects();
  const list = await metasProjects(ADMIN);
  const found = list.find((p) => p.id === mirantes.id);
  expect(found).toMatchObject({
    name: "Mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
  });
});

it("ref de projeto inexistente → erro", async () => {
  await twoProjects();
  await expect(metasList(ADMIN, { project: "naoexiste" })).rejects.toThrow();
});

it("goalId direto ainda funciona (compat)", async () => {
  await twoProjects();
  const g = await metasCreate(ADMIN, {
    project: "mirantes.live",
    title: "por id",
    dueDate: future().toISOString(),
  });
  const up = await metasUpdate(ADMIN, { goalId: g.id, status: "done" });
  expect(up.status).toBe("done");
});
