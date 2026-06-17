import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { backfillCommitMerges } from "@/lib/github/backfill-merges";
import { ghCommit, ghMerge, makeStubClient } from "../setup/github";

// Estado PRÉ-migração: commits gravados com isMerge=false e eventos commit.created (como o
// histórico real). O re-fetch reclassifica os merges. m1 é merge (2 parents); c1 é normal.
async function seed() {
  const owner = await db.user.create({
    data: { email: "o@x.com", passwordHash: "x", role: "admin" },
  });
  const project = await db.project.create({
    data: {
      userId: owner.id,
      name: "P",
      owner: "o",
      repo: "r",
      defaultBranch: "main",
    },
  });
  for (const sha of ["c1", "m1"]) {
    await db.commit.create({
      data: {
        projectId: project.id,
        sha,
        message: sha === "m1" ? "Merge pull request #1" : "feat: x",
        author: "Ana",
        committedAt: new Date("2026-06-10T12:00:00Z"),
      },
    });
    await db.event.create({
      data: {
        source: "commit",
        type: "commit.created",
        refId: sha,
        projectId: project.id,
        title: sha,
      },
    });
  }
  return project;
}

// Stub do GitHub: devolve os commits COM parents (m1 = 2 → merge; c1 = 1 → normal).
const stubClientFor = () => async () =>
  makeStubClient({
    defaultBranch: "main",
    commits: [
      ghCommit("c1", "feat: x"),
      ghMerge("m1", "Merge pull request #1"),
    ],
    branches: [],
    runs: [],
  });

it("re-fetch marca isMerge e vira commit.created → commit.merged só dos merges", async () => {
  const project = await seed();
  const res = await backfillCommitMerges(stubClientFor());

  expect(res.commitsMarked).toBe(1);
  expect(res.eventsUpdated).toBe(1);
  expect((await db.commit.findFirst({ where: { sha: "m1" } }))?.isMerge).toBe(
    true,
  );
  expect((await db.commit.findFirst({ where: { sha: "c1" } }))?.isMerge).toBe(
    false,
  );
  expect(
    await db.event.count({
      where: { projectId: project.id, type: "commit.merged" },
    }),
  ).toBe(1);
  expect(
    await db.event.count({
      where: { projectId: project.id, type: "commit.created" },
    }),
  ).toBe(1);
  const merged = await db.event.findFirst({ where: { type: "commit.merged" } });
  expect(merged?.refId).toBe("m1");
});

it("idempotente: rodar de novo não reclassifica nada", async () => {
  await seed();
  await backfillCommitMerges(stubClientFor());
  const again = await backfillCommitMerges(stubClientFor());
  expect(again.commitsMarked).toBe(0); // já marcado (where isMerge:false)
  expect(again.eventsUpdated).toBe(0); // já é commit.merged
  expect(await db.event.count({ where: { type: "commit.merged" } })).toBe(1);
});

it("projeto sem conexão (clientFor → null) é pulado, sem tocar eventos", async () => {
  await seed();
  const res = await backfillCommitMerges(async () => null);
  expect(res.skipped).toBe(1);
  expect(res.commitsMarked).toBe(0);
  expect(await db.event.count({ where: { type: "commit.merged" } })).toBe(0);
});
