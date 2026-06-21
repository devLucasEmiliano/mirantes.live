import { db } from "@/lib/db";

// Pré-seed da home pública (spec 016): marca os projetos da vitrine `/` como PÚBLICOS e cria
// 1 projeto PRIVADO de controle (prova que privado nunca aparece no seletor). Idempotente.
// Roda por último no global-setup (depois que todos os projetos já existem).
//
// Vitrine pública resultante (createdAt asc):
//   1) devlucasemiliano/mirantes.live (admin)  — mais antigo → seleção default da `/`
//   2) cliente-owner/cliente-repo (cliente)     — 2º dono → o seletor tem ≥2 opções
// + secret-owner/secret (admin, PRIVADO) — não deve aparecer no seletor público.
async function main() {
  const { count } = await db.project.updateMany({
    where: {
      OR: [
        { owner: "devlucasemiliano", repo: "mirantes.live" },
        { owner: "cliente-owner", repo: "cliente-repo" },
      ],
    },
    data: { isPublic: true },
  });

  const admin = await db.user.findFirstOrThrow({
    where: { email: "admin@mirantes.live" },
  });
  await db.project.upsert({
    where: {
      userId_owner_repo: {
        userId: admin.id,
        owner: "secret-owner",
        repo: "secret",
      },
    },
    update: { isPublic: false },
    create: {
      userId: admin.id,
      name: "Repo Privado",
      owner: "secret-owner",
      repo: "secret",
      isPublic: false,
    },
  });

  console.log(
    `[e2e-seed] públicos marcados: ${count} (mirantes.live, cliente-repo) + 1 privado (secret).`,
  );
}

main()
  .catch((error) => {
    console.error("[e2e-seed-public] falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
