import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";

// Pré-seed determinístico p/ a jornada de Equipes (spec 022). Cria um 2º usuário CLIENTE
// (equipe@mirantes.live), a equipe "Equipe QA", adiciona esse usuário como membro e atribui o
// projeto DO ADMIN (devlucasemiliano/mirantes.live, já semeado com metas por seed-metas.ts) à
// equipe. Idempotente (upsert/findFirst+create). Roda via `bun run` no global-setup, DEPOIS de
// seed-metas.ts (a equipe precisa do projeto + metas já semeados).

async function main() {
  const admin = await db.user.findFirstOrThrow({
    where: { email: "admin@mirantes.live" },
  });
  const project = await db.project.findFirstOrThrow({
    where: { userId: admin.id },
    orderBy: { createdAt: "asc" },
  });

  const member = await db.user.upsert({
    where: { email: "equipe@mirantes.live" },
    update: {},
    create: {
      email: "equipe@mirantes.live",
      passwordHash: await hashPassword("equipe-dev-2026"),
      role: "client",
      name: "Membro Equipe",
    },
  });

  const team =
    (await db.team.findFirst({ where: { name: "Equipe QA" } })) ??
    (await db.team.create({ data: { name: "Equipe QA" } }));

  await db.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: member.id } },
    update: {},
    create: { teamId: team.id, userId: member.id },
  });

  await db.project.update({
    where: { id: project.id },
    data: { teamId: team.id },
  });

  console.log(
    "[e2e-seed] equipe semeada: Equipe QA (equipe@mirantes.live → projeto do admin).",
  );
}

main()
  .catch((error) => {
    console.error("[e2e-seed-teams] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
