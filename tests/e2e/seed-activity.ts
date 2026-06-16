import { db } from "@/lib/db";

// Pré-seed determinístico do log de atividade do projeto dev p/ os testes e2e (spec 008).
// Idempotente (createMany skipDuplicates / upsert) — pode rodar a cada global-setup sem
// duplicar. Roda via `bun run` no global-setup do Playwright (runtime real do app).

async function main() {
  const project = await db.project.findFirst({
    where: { owner: "devlucasemiliano", repo: "mirantes.live" },
  });
  if (!project) {
    console.warn(
      "[e2e-seed] projeto dev ausente — rode `prisma db seed` antes.",
    );
    return;
  }

  await db.commit.createMany({
    data: [
      {
        projectId: project.id,
        sha: "e2e0001abc",
        message: "feat: pré-seed e2e",
        author: "Ana",
        committedAt: new Date("2026-06-10T12:00:00Z"),
      },
      {
        projectId: project.id,
        sha: "e2e0002def",
        message: "fix: segundo commit e2e",
        author: "Bruno",
        committedAt: new Date("2026-06-11T09:00:00Z"),
      },
    ],
    skipDuplicates: true,
  });

  await db.branch.upsert({
    where: { projectId_name: { projectId: project.id, name: "main" } },
    update: { commitSha: "e2e0001abc", isDefault: true },
    create: {
      projectId: project.id,
      name: "main",
      commitSha: "e2e0001abc",
      isDefault: true,
    },
  });

  await db.workflowRun.upsert({
    where: { projectId_runId: { projectId: project.id, runId: BigInt(1) } },
    update: { status: "completed", conclusion: "success" },
    create: {
      projectId: project.id,
      runId: BigInt(1),
      name: "CI",
      headBranch: "main",
      headSha: "e2e0001abc",
      status: "completed",
      conclusion: "success",
      runNumber: 1,
      htmlUrl:
        "https://github.com/devlucasemiliano/mirantes.live/actions/runs/1",
      runStartedAt: new Date("2026-06-10T12:00:00Z"),
      updatedAt: new Date("2026-06-10T12:05:00Z"),
    },
  });

  console.log("[e2e-seed] atividade pré-semeada (commits/branch/run).");
}

main()
  .catch((error) => {
    console.error("[e2e-seed] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
