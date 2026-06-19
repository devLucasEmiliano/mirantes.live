import { expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  archiveGoal,
  createGoal,
  listGoals,
  updateGoal,
} from "@/lib/goals/service";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const asClient = (userId: string) => ({ role: "client", userId }) as const;

async function projectOf(role: "admin" | "client" = "admin") {
  const u = await seedUser({
    email: `${role}-${Math.round(Math.abs(Math.sin(1)) * 1)}@x.com`.replace(
      "0",
      role,
    ),
    password: "p",
    role,
  });
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: role,
  });
  if (!p.ok) throw new Error("setup");
  return { user: u, project: p.project };
}

it("short code sequencial M-1/M-2 por projeto e position incremental", async () => {
  const { project } = await projectOf("admin");
  const a = await createGoal(ADMIN, {
    projectId: project.id,
    title: "A",
    dueDate: future(),
  });
  const b = await createGoal(ADMIN, {
    projectId: project.id,
    title: "B",
    dueDate: future(),
  });
  if (!a.ok || !b.ok) throw new Error("create");
  expect(a.goal.shortCode).toBe("M-1");
  expect(b.goal.shortCode).toBe("M-2");
  expect(b.goal.position).toBeGreaterThan(a.goal.position);
});

it("escopo: cliente vê só as suas; meta alheia → not_found", async () => {
  const admin = await projectOf("admin");
  const client = await projectOf("client");
  await createGoal(ADMIN, {
    projectId: admin.project.id,
    title: "do admin",
    dueDate: future(),
  });
  const mine = await createGoal(asClient(client.user.id), {
    projectId: client.project.id,
    title: "do client",
    dueDate: future(),
  });
  if (!mine.ok) throw new Error("create");
  const seen = await listGoals(asClient(client.user.id));
  expect(seen.map((g) => g.title)).toEqual(["do client"]);
  expect(await listGoals(ADMIN)).toHaveLength(2);
  const denied = await updateGoal(
    asClient(client.user.id),
    admin.project.id /* not a goal */,
    { title: "x" },
  );
  expect(denied.ok).toBe(false);
});

it("editar progress/status de PAI com filhos → has_children", async () => {
  const { project } = await projectOf("admin");
  const parent = await createGoal(ADMIN, {
    projectId: project.id,
    title: "Pai",
    dueDate: future(),
  });
  if (!parent.ok) throw new Error("p");
  await createGoal(ADMIN, {
    projectId: project.id,
    title: "Filho",
    dueDate: future(),
    parentId: parent.goal.id,
  });
  const res = await updateGoal(ADMIN, parent.goal.id, { progress: 80 });
  expect(res).toEqual({ ok: false, error: "has_children" });
});

it("status→done seta completedAt; sair de done limpa", async () => {
  const { project } = await projectOf("admin");
  const g = await createGoal(ADMIN, {
    projectId: project.id,
    title: "Folha",
    dueDate: future(),
  });
  if (!g.ok) throw new Error("g");
  await updateGoal(ADMIN, g.goal.id, { status: "done" });
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: g.goal.id } })).completedAt,
  ).not.toBeNull();
  await updateGoal(ADMIN, g.goal.id, { status: "in_progress" });
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: g.goal.id } })).completedAt,
  ).toBeNull();
});

it("arquivar cascateia e some da árvore; deletar projeto cascateia metas", async () => {
  const { project } = await projectOf("admin");
  const parent = await createGoal(ADMIN, {
    projectId: project.id,
    title: "Pai",
    dueDate: future(),
  });
  if (!parent.ok) throw new Error("p");
  await createGoal(ADMIN, {
    projectId: project.id,
    title: "Filho",
    dueDate: future(),
    parentId: parent.goal.id,
  });
  await archiveGoal(ADMIN, parent.goal.id);
  expect(await listGoals(ADMIN)).toHaveLength(0);
  expect(await db.goal.count({ where: { deletedAt: null } })).toBe(0);
  await db.project.delete({ where: { id: project.id } });
  expect(await db.goal.count()).toBe(0);
});
