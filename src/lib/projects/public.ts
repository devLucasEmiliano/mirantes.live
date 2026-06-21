import type { Project } from "@prisma/client";
import { db } from "@/lib/db";

// Camada PÚBLICA de projetos (spec 016) — scope-free: a visibilidade `isPublic` É a
// autorização (não há `Scope`). Lê só projetos marcados públicos; jamais serve um privado.
// Único portão Postgres do caminho da home `/` anônima.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Projetos públicos (qualquer dono), do mais antigo p/ o mais novo. */
export async function listPublicProjects(): Promise<Project[]> {
  return db.project.findMany({
    where: { isPublic: true },
    orderBy: { createdAt: "asc" },
  });
}

/** 1 projeto SE público; senão `null` (limite de segurança — privado nunca é servido). */
export async function getPublicProject(id: string): Promise<Project | null> {
  return db.project.findFirst({ where: { id, isPublic: true } });
}

/**
 * Commits do projeto público na janela atual (≤7d) e anterior (7–14d), p/ o card "Commits da
 * Semana". Espelha `weeklyCommitStats`, mas fixo em 1 projeto e sem `Scope`.
 */
export async function publicWeeklyCommitStats(
  projectId: string,
): Promise<{ count: number; previousCount: number }> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS);
  const [count, previousCount] = await Promise.all([
    db.commit.count({
      where: { projectId, committedAt: { gte: sevenDaysAgo } },
    }),
    db.commit.count({
      where: {
        projectId,
        committedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
  ]);
  return { count, previousCount };
}
