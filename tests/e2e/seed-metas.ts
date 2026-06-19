import { db } from "@/lib/db";

// Pré-seed determinístico das Metas (spec 013). Idempotente por (projectId, shortCode).
// M-1 "Entregar login" 0→2 com 1 commit atribuído (1/2, em progresso);
// M-2 "Publicar v1" 0→1 com 1 commit atribuído (1/1, concluída). Tudo no projeto-vitrine do admin.
async function main() {
  const admin = await db.user.findFirstOrThrow({
    where: { email: "admin@mirantes.live" },
  });
  const project = await db.project.findFirstOrThrow({
    where: { userId: admin.id },
    orderBy: { createdAt: "asc" },
  });

  await db.goalCodeCounter.upsert({
    where: { projectId: project.id },
    update: {},
    create: { projectId: project.id, next: 3 },
  });
  const due = new Date("2026-12-31");
  const m1 = await db.goal.upsert({
    where: {
      projectId_shortCode: { projectId: project.id, shortCode: "M-1" },
    },
    update: {},
    create: {
      projectId: project.id,
      shortCode: "M-1",
      title: "Entregar login",
      status: "in_progress",
      progress: 0,
      dueDate: due,
      startValue: 0,
      targetValue: 2,
      currentValue: 1,
      position: 1,
    },
  });
  const m2 = await db.goal.upsert({
    where: {
      projectId_shortCode: { projectId: project.id, shortCode: "M-2" },
    },
    update: {},
    create: {
      projectId: project.id,
      shortCode: "M-2",
      title: "Publicar v1",
      status: "done",
      progress: 100,
      dueDate: due,
      startValue: 0,
      targetValue: 1,
      currentValue: 1,
      position: 2,
      completedAt: new Date("2026-06-12T10:00:00Z"),
    },
  });
  for (const [goal, sha, msg] of [
    [m1, "metac001", "feat: tela de login (M-1)"],
    [m2, "metac002", "feat: release v1 (M-2)"],
  ] as const) {
    const commit = await db.commit.upsert({
      where: { projectId_sha: { projectId: project.id, sha } },
      update: {},
      create: {
        projectId: project.id,
        sha,
        message: msg,
        author: "Ana",
        committedAt: new Date("2026-06-12T09:00:00Z"),
      },
    });
    await db.commitGoalLink.upsert({
      where: { commitId_goalId: { commitId: commit.id, goalId: goal.id } },
      update: {},
      create: {
        commitId: commit.id,
        goalId: goal.id,
        weight: 1,
        method: "keyword",
        appliedValue: 1,
      },
    });
  }
  console.log("[e2e-seed] metas semeadas: M-1 (1/2), M-2 (concluída).");
}

main()
  .catch((error) => {
    console.error("[e2e-seed-metas] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
