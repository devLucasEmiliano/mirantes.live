import { db } from "@/lib/db";
import { backfillEvents } from "@/lib/events/backfill";

// Pré-seed determinístico p/ a jornada da Timeline (spec 012). Idempotente.
// 1) Garante um 2º projeto do admin (com commit distinto) p/ a troca de projeto no header.
// 2) Backfilla os eventos dos commits/runs já semeados (seed-activity) → timeline não vazia.
// 3) Cria 1 evento INVISÍVEL na vitrine (projeto dev) p/ provar o filtro público da home.
async function main() {
  const admin = await db.user.findFirstOrThrow({
    where: { email: "admin@mirantes.live" },
  });

  const second = await db.project.upsert({
    where: {
      userId_owner_repo: {
        userId: admin.id,
        owner: "devlucasemiliano",
        repo: "segundo-repo",
      },
    },
    update: {},
    create: {
      userId: admin.id,
      name: "Segundo Repo",
      owner: "devlucasemiliano",
      repo: "segundo-repo",
    },
  });
  await db.commit.upsert({
    where: { projectId_sha: { projectId: second.id, sha: "seg00001" } },
    update: {},
    create: {
      projectId: second.id,
      sha: "seg00001",
      message: "feat: commit do segundo projeto",
      author: "Carla",
      committedAt: new Date("2026-06-12T10:00:00Z"),
    },
  });

  const res = await backfillEvents();

  // Vitrine = projeto mais antigo do admin (dev). 1 evento invisível p/ testar o filtro público.
  const showcase = await db.project.findFirstOrThrow({
    where: {
      userId: admin.id,
      owner: "devlucasemiliano",
      repo: "mirantes.live",
    },
  });
  const hiddenTitle = "evento oculto e2e";
  const exists = await db.event.findFirst({
    where: { projectId: showcase.id, title: hiddenTitle },
  });
  if (!exists) {
    await db.event.create({
      data: {
        source: "commit",
        type: "commit.created",
        refId: "hidden-e2e",
        projectId: showcase.id,
        title: hiddenTitle,
        detail: "não deve aparecer na home pública",
        visibleToClient: false,
        createdAt: new Date("2026-06-13T10:00:00Z"),
      },
    });
  }

  console.log(
    `[e2e-seed] eventos backfillados: ${res.commits} commits, ${res.runs} runs (+1 oculto).`,
  );
}

main()
  .catch((error) => {
    console.error("[e2e-seed-events] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
