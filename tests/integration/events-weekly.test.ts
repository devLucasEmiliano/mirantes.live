import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { weeklyEventStats } from "@/lib/events";
import { createProject } from "@/lib/projects";
import { seedUser } from "../setup/db";

const ADMIN = { role: "admin" } as const;
const DAY = 24 * 60 * 60 * 1000;

it("conta eventos da semana por tipo (7d), ignorando os mais antigos", async () => {
  const a = await seedUser({ email: "a@x.com", password: "p", role: "admin" });
  const p = await createProject({
    userId: a.id,
    name: "P",
    owner: "o",
    repo: "p",
  });
  if (!p.ok) throw new Error("setup");
  const now = Date.now();
  await db.event.createMany({
    data: [
      {
        source: "commit",
        type: "commit.created",
        projectId: p.project.id,
        title: "c1",
        createdAt: new Date(now - 1 * DAY),
      },
      {
        source: "commit",
        type: "commit.created",
        projectId: p.project.id,
        title: "c2",
        createdAt: new Date(now - 2 * DAY),
      },
      {
        source: "commit",
        type: "ci.run",
        projectId: p.project.id,
        title: "ci1",
        createdAt: new Date(now - 3 * DAY),
      },
      {
        source: "commit",
        type: "commit.created",
        projectId: p.project.id,
        title: "antigo",
        createdAt: new Date(now - 10 * DAY),
      },
    ],
  });
  const stats = await weeklyEventStats(ADMIN);
  expect(stats).toEqual({ commits: 2, ci: 1, total: 3 });
});
