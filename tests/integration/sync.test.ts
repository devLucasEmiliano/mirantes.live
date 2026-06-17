import { expect, it } from "vitest";
import { db } from "@/lib/db";
import { syncProject } from "@/lib/github/sync";
import { ghBranch, ghCommit, ghRun, makeStubClient } from "../setup/github";

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

it("1º sync insere commits, branches e runs e avança o cursor", async () => {
  const project = await seedProject();
  const res = await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a1"), ghBranch("feat-x", "b9")],
      runs: [ghRun(1), ghRun(2)],
    }),
  );
  expect(res).toMatchObject({
    ok: true,
    inserted: { commits: 3, branches: 2, runs: 2 },
  });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(3);
  const main = await db.branch.findFirstOrThrow({
    where: { projectId: project.id, name: "main" },
  });
  expect(main.isDefault).toBe(true);
  const after = await db.project.findUniqueOrThrow({
    where: { id: project.id },
  });
  expect(after.lastSeenSha).toBe("a1");
  expect(after.lastPolledAt).not.toBeNull();
});

it("2º sync deduplica commits por SHA e só insere os novos", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  const res = await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [ghCommit("a4"), ghCommit("a1"), ghCommit("a2"), ghCommit("a3")],
      branches: [ghBranch("main", "a4")],
      runs: [],
    }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 1 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(4);
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: project.id } }))
      .lastSeenSha,
  ).toBe("a4");
});

it("sem commits novos: total intacto, lastPolledAt ainda atualiza", async () => {
  const project = await seedProject();
  const res = await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main", "a1")],
      runs: [],
    }),
  );
  expect(res).toMatchObject({ ok: true, inserted: { commits: 0 } });
  expect(await db.commit.count({ where: { projectId: project.id } })).toBe(0);
  expect(
    (await db.project.findUniqueOrThrow({ where: { id: project.id } }))
      .lastPolledAt,
  ).not.toBeNull();
});

it("branches: remove as que sumiram e mantém as atuais", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main"), ghBranch("feat-x")],
      runs: [],
    }),
  );
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main"), ghBranch("feat-y")],
      runs: [],
    }),
  );
  const names = (
    await db.branch.findMany({
      where: { projectId: project.id },
      orderBy: { name: "asc" },
    })
  ).map((b) => b.name);
  expect(names).toEqual(["feat-y", "main"]);
});

it("workflow runs: upsert por runId atualiza o mesmo registro", async () => {
  const project = await seedProject();
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(1, { status: "in_progress", conclusion: null })],
    }),
  );
  await syncProject(
    project.id,
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [ghBranch("main")],
      runs: [ghRun(1, { status: "completed", conclusion: "success" })],
    }),
  );
  const runs = await db.workflowRun.findMany({
    where: { projectId: project.id },
  });
  expect(runs).toHaveLength(1);
  expect(runs[0]?.status).toBe("completed");
  expect(runs[0]?.conclusion).toBe("success");
});

it("projeto inexistente → project_not_found", async () => {
  const res = await syncProject(
    "00000000-0000-0000-0000-000000000000",
    makeStubClient({
      defaultBranch: "main",
      commits: [],
      branches: [],
      runs: [],
    }),
  );
  expect(res).toEqual({ ok: false, error: "project_not_found" });
});

it("dono sem conexão e sem client injetado → not_connected (sem rede)", async () => {
  const project = await seedProject();
  const res = await syncProject(project.id); // dono não tem GithubConnection
  expect(res).toEqual({ ok: false, error: "not_connected" });
});
