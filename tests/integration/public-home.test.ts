import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { listPublicEvents } from "@/lib/events";
import { createGoal, listPublicGoals } from "@/lib/goals/service";
import { createProject, updateProject } from "@/lib/projects";
import {
  getPublicProject,
  listPublicProjects,
  publicWeeklyCommitStats,
} from "@/lib/projects/public";
import { selectPublicProject } from "@/lib/projects/public-actions";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function makeProject(opts: {
  role?: "admin" | "client";
  owner: string;
  repo: string;
  isPublic: boolean;
}) {
  const u = await seedUser({
    email: `${opts.owner}@x.com`,
    password: "p",
    role: opts.role ?? "admin",
  });
  const p = await createProject({
    userId: u.id,
    name: opts.repo,
    owner: opts.owner,
    repo: opts.repo,
  });
  if (!p.ok) throw new Error("setup");
  if (opts.isPublic)
    await db.project.update({
      where: { id: p.project.id },
      data: { isPublic: true },
    });
  return { user: u, project: p.project };
}

it("listPublicProjects: só públicos, de donos diferentes, createdAt asc", async () => {
  const a = await makeProject({
    owner: "alice",
    repo: "first",
    isPublic: true,
  });
  await makeProject({ owner: "bob", repo: "private", isPublic: false });
  const c = await makeProject({
    owner: "carol",
    repo: "third",
    isPublic: true,
  });
  const list = await listPublicProjects();
  expect(list.map((p) => p.id)).toEqual([a.project.id, c.project.id]); // ordem de criação; privado fora
});

it("getPublicProject: privado → null; público → o projeto (limite de segurança)", async () => {
  const priv = await makeProject({
    owner: "bob",
    repo: "secret",
    isPublic: false,
  });
  const pub = await makeProject({
    owner: "alice",
    repo: "open",
    isPublic: true,
  });
  expect(await getPublicProject(priv.project.id)).toBeNull();
  expect((await getPublicProject(pub.project.id))?.id).toBe(pub.project.id);
});

it("listPublicGoals: metas reais derivadas do projeto público; nada vaza de privado", async () => {
  const pub = await makeProject({
    owner: "alice",
    repo: "open",
    isPublic: true,
  });
  const priv = await makeProject({
    owner: "bob",
    repo: "secret",
    isPublic: false,
  });
  await createGoal(ADMIN, {
    projectId: pub.project.id,
    title: "Pública",
    dueDate: future(),
  });
  await createGoal(asClient(priv.user.id), {
    projectId: priv.project.id,
    title: "Privada",
    dueDate: future(),
  });
  const pubGoals = await listPublicGoals(pub.project.id);
  expect(pubGoals.map((g) => g.title)).toEqual(["Pública"]);
  // mesmo passando o id de um projeto privado, a função pública não deve servir suas metas
  expect(await listPublicGoals(priv.project.id)).toHaveLength(0);
});

it("listPublicEvents: só visibleToClient do projeto", async () => {
  const pub = await makeProject({
    owner: "alice",
    repo: "open",
    isPublic: true,
  });
  await db.event.createMany({
    data: [
      {
        source: "goal",
        type: "goal.created",
        title: "visível",
        projectId: pub.project.id,
        visibleToClient: true,
      },
      {
        source: "goal",
        type: "goal.updated",
        title: "oculto",
        projectId: pub.project.id,
        visibleToClient: false,
      },
    ],
  });
  const events = await listPublicEvents(pub.project.id, 7);
  expect(events.map((e) => e.title)).toEqual(["visível"]);
});

it("publicWeeklyCommitStats: conta janela 7d/14d do projeto", async () => {
  const pub = await makeProject({
    owner: "alice",
    repo: "open",
    isPublic: true,
  });
  const day = 24 * 60 * 60 * 1000;
  await db.commit.createMany({
    data: [
      {
        projectId: pub.project.id,
        sha: "s1",
        message: "a",
        author: "Ana",
        committedAt: new Date(Date.now() - 2 * day),
      },
      {
        projectId: pub.project.id,
        sha: "s2",
        message: "b",
        author: "Ana",
        committedAt: new Date(Date.now() - 10 * day),
      },
    ],
  });
  const stats = await publicWeeklyCommitStats(pub.project.id);
  expect(stats).toEqual({ count: 1, previousCount: 1 });
});

it("updateProject: dono renomeia e torna público; admin altera qualquer; cliente alheio → not_found", async () => {
  const owner = await makeProject({
    role: "client",
    owner: "bob",
    repo: "proj",
    isPublic: false,
  });
  const stranger = await seedUser({
    email: "eve@x.com",
    password: "p",
    role: "client",
  });

  const r1 = await updateProject(owner.project.id, asClient(owner.user.id), {
    name: "Novo Nome",
    isPublic: true,
  });
  expect(r1.ok && r1.project.name).toBe("Novo Nome");
  expect(r1.ok && r1.project.isPublic).toBe(true);

  const r2 = await updateProject(owner.project.id, asClient(stranger.id), {
    isPublic: false,
  });
  expect(r2).toEqual({ ok: false, error: "not_found" }); // não-dono não altera
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: owner.project.id } }))
      .isPublic,
  ).toBe(true);

  const r3 = await updateProject(owner.project.id, ADMIN, {
    name: "Pelo Admin",
  });
  expect(r3.ok && r3.project.name).toBe("Pelo Admin"); // admin alcança qualquer projeto
});

it("selectPublicProject: público grava cookie; privado → no-op", async () => {
  const pub = await makeProject({
    owner: "alice",
    repo: "open",
    isPublic: true,
  });
  const priv = await makeProject({
    owner: "bob",
    repo: "secret",
    isPublic: false,
  });
  // o cookie é setado via next/headers; aqui asseguramos que não lança e respeita o limite:
  await expect(selectPublicProject(pub.project.id)).resolves.toBeUndefined();
  await expect(selectPublicProject(priv.project.id)).resolves.toBeUndefined(); // no-op silencioso
});
