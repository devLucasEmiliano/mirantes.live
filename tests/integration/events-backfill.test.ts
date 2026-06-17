import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { backfillEvents } from "@/lib/events/backfill";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

// Backfill dos commits/runs já no banco (nascidos antes da spec 012). Idempotente:
// dedupe por (projectId, refId); run `in_progress` não vira evento.

async function seedActivity() {
  const u = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: u.id,
    name: "P",
    owner: "o",
    repo: "repo",
  });
  if (!p.ok) throw new Error("setup");
  await db.commit.createMany({
    data: [
      {
        projectId: p.project.id,
        sha: "s1",
        message: "feat: um",
        author: "Ana",
        committedAt: new Date("2026-06-10T12:00:00Z"),
      },
      {
        projectId: p.project.id,
        sha: "s2",
        message: "fix: dois",
        author: "Bruno",
        committedAt: new Date("2026-06-11T09:00:00Z"),
      },
    ],
  });
  await db.workflowRun.create({
    data: {
      projectId: p.project.id,
      runId: BigInt(5),
      name: "CI",
      headBranch: "main",
      headSha: "s1",
      status: "completed",
      conclusion: "success",
      runNumber: 5,
      htmlUrl: "h",
      runStartedAt: new Date("2026-06-10T12:00:00Z"),
      updatedAt: new Date("2026-06-10T12:05:00Z"),
    },
  });
  // Run ainda em andamento → NÃO deve virar evento.
  await db.workflowRun.create({
    data: {
      projectId: p.project.id,
      runId: BigInt(6),
      name: "CI",
      headBranch: "main",
      headSha: "s2",
      status: "in_progress",
      conclusion: null,
      runNumber: 6,
      htmlUrl: "h",
      runStartedAt: new Date("2026-06-11T09:00:00Z"),
      updatedAt: new Date("2026-06-11T09:01:00Z"),
    },
  });
  return p.project;
}

it("backfilla commits e runs concluídas já no banco; idempotente", async () => {
  const project = await seedActivity();
  const res = await backfillEvents();
  expect(res).toEqual({ commits: 2, runs: 1 });

  const events = await db.event.findMany({
    where: { projectId: project.id },
    orderBy: { id: "asc" },
  });
  expect(events.filter((e) => e.type === "commit.created")).toHaveLength(2);
  expect(events.filter((e) => e.type === "ci.run")).toHaveLength(1);
  const ci = events.find((e) => e.type === "ci.run");
  expect(ci?.refId).toBe("5");
  expect(ci?.title).toBe("CI CI #5: sucesso");

  // 2ª passada não reemite (dedupe por projectId+refId).
  const again = await backfillEvents();
  expect(again).toEqual({ commits: 0, runs: 0 });
  expect(await db.event.count({ where: { projectId: project.id } })).toBe(3);
});
