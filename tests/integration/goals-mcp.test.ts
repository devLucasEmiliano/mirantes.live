import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { metasCreate, metasLinkCommit, metasList } from "@/lib/mcp/tools";
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
