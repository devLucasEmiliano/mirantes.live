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
import { seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;
const mkUser = (email: string, role = "client") =>
  seedUser({ email, password: "pass-123", role });
const day = 24 * 60 * 60 * 1000;
const commit = (projectId: string, sha: string, ageDays = 1) =>
  db.commit.create({
    data: {
      projectId,
      sha,
      message: "m",
      author: "a",
      committedAt: new Date(Date.now() - ageDays * day),
    },
  });

it("cria projeto válido e carimba o dono", async () => {
  const u = await mkUser("a@x.com");
  const res = await createProject({
    userId: u.id,
    name: "Mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
  });
  if (!res.ok) throw new Error("setup");
  expect(res.project.userId).toBe(u.id);
  expect(await db.project.count()).toBe(1);
});
it("rejeita slug inválido sem gravar", async () => {
  const u = await mkUser("a@x.com");
  expect(
    await createProject({ userId: u.id, name: "X", owner: "a b", repo: "x" }),
  ).toEqual({ ok: false, error: "invalid_slug" });
  expect(await db.project.count()).toBe(0);
});
it("rejeita (owner,repo) duplicado para o MESMO usuário", async () => {
  const u = await mkUser("a@x.com");
  await createProject({ userId: u.id, name: "X", owner: "o", repo: "r" });
  expect(
    await createProject({ userId: u.id, name: "Y", owner: "o", repo: "r" }),
  ).toEqual({ ok: false, error: "already_exists" });
  expect(await db.project.count()).toBe(1);
});
it("o mesmo repo pode existir para usuários diferentes", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  await createProject({ userId: a.id, name: "A", owner: "o", repo: "r" });
  expect(
    (await createProject({ userId: b.id, name: "B", owner: "o", repo: "r" }))
      .ok,
  ).toBe(true);
  expect(await db.project.count()).toBe(2);
});
it("listProjects: cliente vê só os seus; admin vê todos", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  await createProject({ userId: a.id, name: "A1", owner: "o", repo: "a1" });
  await createProject({ userId: a.id, name: "A2", owner: "o", repo: "a2" });
  await createProject({ userId: b.id, name: "B1", owner: "o", repo: "b1" });
  expect(
    (await listProjects(asClient(a.id))).projects.map((p) => p.name).sort(),
  ).toEqual(["A1", "A2"]);
  expect(
    (await listProjects(asClient(b.id))).projects.map((p) => p.name),
  ).toEqual(["B1"]);
  expect((await listProjects(ADMIN)).projects).toHaveLength(3);
});
it("getProject: cliente em projeto alheio → not_found", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const c = await createProject({
    userId: a.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  if (!c.ok) throw new Error("setup");
  expect(await getProject(c.project.id, asClient(b.id))).toEqual({
    ok: false,
    error: "not_found",
  });
  expect((await getProject(c.project.id, asClient(a.id))).ok).toBe(true);
  expect((await getProject(c.project.id, ADMIN)).ok).toBe(true);
});
it("deleteProject: cliente não apaga projeto alheio", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const c = await createProject({
    userId: a.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  if (!c.ok) throw new Error("setup");
  expect(await deleteProject(c.project.id, asClient(b.id))).toEqual({
    ok: false,
    error: "not_found",
  });
  expect(await db.project.count()).toBe(1);
  expect(await deleteProject(c.project.id, asClient(a.id))).toEqual({
    ok: true,
  });
});
it("weeklyCommitStats escopado por dono", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const pa = await createProject({
    userId: a.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  const pb = await createProject({
    userId: b.id,
    name: "B",
    owner: "o",
    repo: "b",
  });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await commit(pa.project.id, "a1", 1);
  await commit(pa.project.id, "a2", 2);
  await commit(pb.project.id, "b1", 1);
  expect(await weeklyCommitStats(asClient(a.id))).toEqual({
    count: 2,
    previousCount: 0,
  });
  expect(await weeklyCommitStats(asClient(b.id))).toEqual({
    count: 1,
    previousCount: 0,
  });
  expect(await weeklyCommitStats(ADMIN)).toEqual({
    count: 3,
    previousCount: 0,
  });
});
it("latestCommit escopado por dono", async () => {
  const a = await mkUser("a@x.com");
  const b = await mkUser("b@x.com");
  const pa = await createProject({
    userId: a.id,
    name: "ProjA",
    owner: "o",
    repo: "a",
  });
  const pb = await createProject({
    userId: b.id,
    name: "ProjB",
    owner: "o",
    repo: "b",
  });
  if (!pa.ok || !pb.ok) throw new Error("setup");
  await db.commit.create({
    data: {
      projectId: pa.project.id,
      sha: "ca",
      message: "m",
      author: "a",
      committedAt: new Date("2026-06-01T00:00:00Z"),
    },
  });
  await db.commit.create({
    data: {
      projectId: pb.project.id,
      sha: "cb",
      message: "m",
      author: "a",
      committedAt: new Date("2026-06-10T00:00:00Z"),
    },
  });
  expect((await latestCommit(asClient(a.id)))?.projectName).toBe("ProjA");
  expect((await latestCommit(ADMIN))?.sha).toBe("cb");
});
it("apagar o usuário cascateia projetos e filhos", async () => {
  const u = await mkUser("a@x.com");
  const c = await createProject({
    userId: u.id,
    name: "A",
    owner: "o",
    repo: "a",
  });
  if (!c.ok) throw new Error("setup");
  await commit(c.project.id, "x1");
  await db.user.delete({ where: { id: u.id } });
  expect(await db.project.count()).toBe(0);
  expect(await db.commit.count()).toBe(0);
});
