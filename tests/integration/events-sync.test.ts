import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import {
  ghBranch,
  ghCommit,
  ghMerge,
  ghRun,
  makeStubClient,
} from "../setup/github";

async function seedProject() {
  const owner = await db.user.create({
    data: { email: "owner@x.com", passwordHash: "x", role: "admin" },
  });
  return db.project.create({
    data: {
      userId: owner.id,
      name: "Mirantes",
      owner: "devlucasemiliano",
      repo: "mirantes.live",
    },
  });
}

it("1º sync emite 1 evento por commit + 1 por run concluída", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [
        ghCommit("a1", "feat: um"),
        ghCommit("a2", "fix: dois"),
        ghCommit("a3", "chore: tres"),
      ],
      branches: [ghBranch("main", "a1")],
      runs: [ghRun(1), ghRun(2)],
    }),
  );
  const events = await db.event.findMany({
    where: { projectId: project.id },
    orderBy: { id: "asc" },
  });
  expect(events.filter((e) => e.type === "commit.created")).toHaveLength(3);
  expect(events.filter((e) => e.type === "ci.run")).toHaveLength(2);
  const c1 = events.find((e) => e.refId === "a1");
  expect(c1?.title).toBe("feat: um");
  expect(c1?.detail).toBe("Ana · mirantes.live · main");
  expect(c1?.createdAt).toEqual(new Date("2026-06-10T12:00:00Z")); // = committedAt
});

it("commit de merge (2 parents) → evento commit.merged e Commit.isMerge", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [
        ghCommit("a1", "feat: um"),
        ghMerge("m1", "Merge pull request #2 from o/feat"),
      ],
      branches: [ghBranch("main", "m1")],
      runs: [],
    }),
  );
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(1);
  expect(await db.event.count({ where: { type: "commit.merged" } })).toBe(1);
  const merge = await db.event.findFirst({ where: { type: "commit.merged" } });
  expect(merge?.refId).toBe("m1");
  expect(merge?.title).toBe("Merge do PR #2");
  expect(merge?.detail).toBe("Ana · mirantes.live · main");
  const row = await db.commit.findFirst({ where: { sha: "m1" } });
  expect(row?.isMerge).toBe(true);
});

it("re-sync idêntico não reemite eventos", async () => {
  const project = await seedProject();
  const client = makeStubClient({
    defaultBranch: "main",
    commits: [ghCommit("a1"), ghCommit("a2")],
    branches: [ghBranch("main", "a1")],
    runs: [ghRun(1)],
  });
  await syncProject(project.id, client);
  await syncProject(project.id, client);
  expect(await db.event.count({ where: { projectId: project.id } })).toBe(3); // 2 commit + 1 ci
});

it("run só vira evento na transição p/ completed", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(9, { status: "in_progress", conclusion: null })],
    }),
  );
  expect(await db.event.count({ where: { type: "ci.run" } })).toBe(0);
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(9, { status: "completed", conclusion: "success" })],
    }),
  );
  const ci = await db.event.findMany({ where: { type: "ci.run" } });
  expect(ci).toHaveLength(1);
  expect(ci[0]?.title).toBe("CI #9 · sucesso");
});

it("2º sync com 1 commit novo emite exatamente 1 commit.created", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1"), ghCommit("a2")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a3"), ghCommit("a1"), ghCommit("a2")],
      branches: [ghBranch("main", "a3")],
      runs: [],
    }),
  );
  expect(await db.event.count({ where: { type: "commit.created" } })).toBe(3);
});
