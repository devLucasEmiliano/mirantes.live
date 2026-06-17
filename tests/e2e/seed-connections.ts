import { db } from "@/lib/db";

// Pré-seed determinístico p/ a jornada de Integrações (spec 009). Cria um projeto do
// CLIENTE (cliente-owner/cliente-repo, userId = cliente) com 2 commits + branch main +
// 1 run. SEM conexões pré-semeadas: o teste de conectar usa o fluxo faked e o de
// sincronizar-sem-conexão depende de NÃO haver conexão. Idempotente (upsert/skipDuplicates).
// Roda via `bun run` no global-setup (após `db seed` + `seed-activity`).

async function main() {
  const client = await db.user.findUnique({
    where: { email: "cliente@mirantes.live" },
  });
  if (!client) {
    console.warn("[e2e-seed] cliente ausente — rode `prisma db seed` antes.");
    return;
  }

  const project = await db.project.upsert({
    where: {
      userId_owner_repo: {
        userId: client.id,
        owner: "cliente-owner",
        repo: "cliente-repo",
      },
    },
    update: { name: "Projeto do Cliente" },
    create: {
      userId: client.id,
      name: "Projeto do Cliente",
      owner: "cliente-owner",
      repo: "cliente-repo",
      defaultBranch: "main",
    },
  });

  await db.commit.createMany({
    data: [
      {
        projectId: project.id,
        sha: "cli0001aaa",
        message: "feat: primeiro commit do cliente",
        author: "Cliente",
        committedAt: new Date("2026-06-12T10:00:00Z"),
      },
      {
        projectId: project.id,
        sha: "cli0002bbb",
        message: "fix: segundo commit do cliente",
        author: "Cliente",
        committedAt: new Date("2026-06-13T09:00:00Z"),
      },
    ],
    skipDuplicates: true,
  });

  await db.branch.upsert({
    where: { projectId_name: { projectId: project.id, name: "main" } },
    update: { commitSha: "cli0001aaa", isDefault: true },
    create: {
      projectId: project.id,
      name: "main",
      commitSha: "cli0001aaa",
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
      headSha: "cli0001aaa",
      status: "completed",
      conclusion: "success",
      runNumber: 1,
      htmlUrl: "https://github.com/cliente-owner/cliente-repo/actions/runs/1",
      runStartedAt: new Date("2026-06-12T10:00:00Z"),
      updatedAt: new Date("2026-06-12T10:05:00Z"),
    },
  });

  console.log(
    "[e2e-seed] projeto do cliente pré-semeado (cliente-owner/cliente-repo).",
  );
}

main()
  .catch((error) => {
    console.error("[e2e-seed] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
