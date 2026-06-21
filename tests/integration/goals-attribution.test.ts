import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { createGoal, linkBranch } from "@/lib/goals/service";
import { createProject } from "@/lib/projects";
import { future, seedUser } from "../setup/db";
import { ghBranch, ghCommit, ghMerge, makeStubClient } from "../setup/github";

const ADMIN = { role: "admin" } as const;

async function seedProjectWithGoal(
  over: Partial<{ start: number; target: number }> = {},
) {
  const owner = await seedUser({
    email: "owner@x.com",
    password: "p",
    role: "admin",
  });
  const p = await createProject({
    userId: owner.id,
    name: "Mirantes",
    owner: "devlucasemiliano",
    repo: "mirantes.live",
  });
  if (!p.ok) throw new Error("setup");
  const g = await createGoal(ADMIN, {
    projectId: p.project.id,
    title: "Entregar login",
    dueDate: future(),
    startValue: over.start ?? 0,
    targetValue: over.target ?? 20,
    currentValue: over.start ?? 0,
  });
  if (!g.ok) throw new Error("goal");
  return { project: p.project, goal: g.goal };
}

it("keyword (M-1) atribui → cria link, move current_value, emite goal.updated", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "feat: tela de login (M-1)")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const link = await db.commitGoalLink.findFirstOrThrow({
    where: { goalId: goal.id },
  });
  expect(link.method).toBe("keyword");
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue,
  ).toBe(1);
  expect(
    await db.event.count({ where: { type: "goal.updated", refId: goal.id } }),
  ).toBe(1);
});

it("branch vinculada (merge cita o nome) atribui com peso de merge", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await linkBranch(ADMIN, goal.id, "feature-login");
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghMerge("m1", "Merge pull request #4 from o/feature-login")],
      branches: [ghBranch("main", "m1")],
      runs: [],
    }),
  );
  const link = await db.commitGoalLink.findFirstOrThrow({
    where: { goalId: goal.id },
  });
  expect(link.method).toBe("branch");
  expect(link.weight).toBe(5); // merge
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue,
  ).toBe(5);
});

it("atingir o alvo → done + goal.completed + completedAt", async () => {
  const { project, goal } = await seedProjectWithGoal({ start: 0, target: 1 });
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "feat: x (M-1)")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const after = await db.goal.findUniqueOrThrow({ where: { id: goal.id } });
  expect(after.currentValue).toBe(1);
  expect(after.status).toBe("done");
  expect(after.completedAt).not.toBeNull();
  expect(
    await db.event.count({ where: { type: "goal.completed", refId: goal.id } }),
  ).toBe(1);
});

it("double-sync não duplica (link e current_value estáveis; sem reemissão)", async () => {
  const { project, goal } = await seedProjectWithGoal();
  const client = makeStubClient({
    defaultBranch: "main",
    commits: [ghCommit("a1", "feat: login (M-1)")],
    branches: [ghBranch("main", "a1")],
    runs: [],
  });
  await syncProject(project.id, client);
  await syncProject(project.id, client);
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(1);
  expect(
    (await db.goal.findUniqueOrThrow({ where: { id: goal.id } })).currentValue,
  ).toBe(1);
  expect(
    await db.event.count({ where: { type: "goal.updated", refId: goal.id } }),
  ).toBe(1);
});

it("sem keyword nem branch → unassigned, sem link, mas commit.created é emitido", async () => {
  const { project, goal } = await seedProjectWithGoal();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1", "chore: bump deps")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  expect(await db.commitGoalLink.count({ where: { goalId: goal.id } })).toBe(0);
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(1);
});
