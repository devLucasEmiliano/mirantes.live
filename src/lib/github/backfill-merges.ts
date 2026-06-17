import { db } from "@/lib/db";
import { createGitHubClient, type GitHubClient } from "./client";
import { resolveUserToken } from "./connection";

// Backfill ÚNICO do passado: commits sincronizados ANTES da coluna `is_merge` (spec dos ícones)
// não sabem se são merge. Re-busca 1 página de commits por projeto na branch padrão — a MESMA
// fonte do sync, então cobre exatamente os commits já no banco (repos ≤100 = histórico inteiro) —
// marca `Commit.isMerge` por (parents>1) e vira os eventos `commit.created` → `commit.merged`.
// Idempotente: re-rodar não muda nada além do necessário. Going-forward o sync já grava isMerge.
// `clientFor` é injetável (stub nos testes); por padrão resolve o token OAuth do dono.

type ProjectRow = {
  id: string;
  userId: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
};

export interface BackfillMergesResult {
  projects: number;
  /** Projetos pulados por falta de conexão/token (não dá p/ re-buscar). */
  skipped: number;
  commitsMarked: number;
  eventsUpdated: number;
}

async function defaultClientFor(
  project: ProjectRow,
): Promise<GitHubClient | null> {
  const resolved = await resolveUserToken(project.userId);
  return resolved.ok ? createGitHubClient(resolved.token) : null;
}

export async function backfillCommitMerges(
  clientFor: (
    project: ProjectRow,
  ) => Promise<GitHubClient | null> = defaultClientFor,
): Promise<BackfillMergesResult> {
  const projects = await db.project.findMany();
  const result: BackfillMergesResult = {
    projects: projects.length,
    skipped: 0,
    commitsMarked: 0,
    eventsUpdated: 0,
  };

  for (const project of projects) {
    const client = await clientFor(project);
    if (!client) {
      result.skipped++;
      continue;
    }
    const commits = await client.listCommits({
      owner: project.owner,
      repo: project.repo,
      sha: project.defaultBranch ?? undefined,
    });
    const mergeShas = commits
      .filter((c) => (c.parents?.length ?? 0) > 1)
      .map((c) => c.sha);
    if (mergeShas.length === 0) continue;

    result.commitsMarked += (
      await db.commit.updateMany({
        where: {
          projectId: project.id,
          sha: { in: mergeShas },
          isMerge: false,
        },
        data: { isMerge: true },
      })
    ).count;
    // Só vira `commit.created` → `commit.merged` (não toca eventos já corretos).
    result.eventsUpdated += (
      await db.event.updateMany({
        where: {
          projectId: project.id,
          type: "commit.created",
          refId: { in: mergeShas },
        },
        data: { type: "commit.merged" },
      })
    ).count;
  }
  return result;
}

// Auto-run direto (`bun run db:backfill-merges`). Cast evita depender de `bun-types` no tsc
// (mesmo idioma de github/worker.ts e events/backfill.ts). Idempotente; precisa do dono conectado.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  backfillCommitMerges()
    .then((r) =>
      console.log(
        `[backfill-merges] ${r.commitsMarked} commits marcados merge, ${r.eventsUpdated} eventos → commit.merged (${r.skipped}/${r.projects} projetos sem conexão).`,
      ),
    )
    .catch((error) => {
      console.error("[backfill-merges] falhou:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
