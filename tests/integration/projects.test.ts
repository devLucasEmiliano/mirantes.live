import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createProject,
  deleteProject,
  getProject,
  latestCommit,
  listProjects,
  weeklyCommitStats,
} from "@/lib/projects";

it("cria projeto válido", async () => {
  const res = await createProject({
    name: "Mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
  });
  expect(res.ok).toBe(true);
  expect(await db.project.count()).toBe(1);
});
it("rejeita slug inválido sem gravar", async () => {
  const res = await createProject({ name: "X", owner: "a b", repo: "x" });
  expect(res).toEqual({ ok: false, error: "invalid_slug" });
  expect(await db.project.count()).toBe(0);
});
it("rejeita (owner, repo) duplicado", async () => {
  await createProject({ name: "X", owner: "o", repo: "r" });
  const res = await createProject({ name: "Y", owner: "o", repo: "r" });
  expect(res).toEqual({ ok: false, error: "already_exists" });
  expect(await db.project.count()).toBe(1);
});
it("lista em ordem de criação", async () => {
  await createProject({ name: "A", owner: "o", repo: "a" });
  await createProject({ name: "B", owner: "o", repo: "b" });
  const res = await listProjects();
  expect(res.projects.map((p) => p.name)).toEqual(["A", "B"]);
});
it("get inexistente → not_found", async () => {
  expect(await getProject("00000000-0000-0000-0000-000000000000")).toEqual({
    ok: false,
    error: "not_found",
  });
});
it("delete cascateia os filhos", async () => {
  const created = await createProject({ name: "A", owner: "o", repo: "a" });
  if (!created.ok) throw new Error("setup falhou");
  await db.commit.create({
    data: {
      projectId: created.project.id,
      sha: "x1",
      message: "m",
      author: "a",
      committedAt: new Date(),
    },
  });
  expect(await deleteProject(created.project.id)).toEqual({ ok: true });
  expect(await db.project.count()).toBe(0);
  expect(await db.commit.count()).toBe(0);
  expect(await deleteProject(created.project.id)).toEqual({
    ok: false,
    error: "not_found",
  });
});
it("weeklyCommitStats conta nas janelas de 7d e 7–14d", async () => {
  const c = await createProject({ name: "A", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  const day = 24 * 60 * 60 * 1000;
  const mk = (sha: string, ageDays: number) =>
    db.commit.create({
      data: {
        projectId: c.project.id,
        sha,
        message: "m",
        author: "a",
        committedAt: new Date(Date.now() - ageDays * day),
      },
    });
  await mk("now1", 1);
  await mk("now2", 3); // janela atual (≤7d)
  await mk("prev1", 9); // janela anterior (7–14d)
  const stats = await weeklyCommitStats();
  expect(stats).toEqual({ count: 2, previousCount: 1 });
});
it("latestCommit devolve o mais recente com o nome do projeto", async () => {
  const c = await createProject({ name: "Mirantes", owner: "o", repo: "a" });
  if (!c.ok) throw new Error("setup");
  await db.commit.create({
    data: {
      projectId: c.project.id,
      sha: "old",
      message: "old",
      author: "a",
      committedAt: new Date("2026-06-01T00:00:00Z"),
    },
  });
  await db.commit.create({
    data: {
      projectId: c.project.id,
      sha: "new",
      message: "novo",
      author: "a",
      committedAt: new Date("2026-06-10T00:00:00Z"),
    },
  });
  const got = await latestCommit();
  expect(got?.sha).toBe("new");
  expect(got?.projectName).toBe("Mirantes");
});
