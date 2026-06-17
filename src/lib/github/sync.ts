import { db } from "@/lib/db";
import {
  commitToEvent,
  type EventInput,
  runToEvent,
  shouldEmitRunEvent,
} from "@/lib/events/emit";
import { createGitHubClient, type GitHubClient, GitHubError } from "./client";
import { resolveUserToken } from "./connection";
import { mapCommit } from "./map";

// Núcleo de sincronização (idempotente): puxa nome/branch padrão, commits, branches e
// workflow runs de 1 projeto e persiste no Postgres. Compartilhado pelo botão manual
// (POST /api/projects/:id/sync) e pelo worker de polling — ambos chamam `syncProject`.
//
// Idempotência: commits via createMany(skipDuplicates) na unique (project,sha); branches
// upsert por (project,name) + remoção das ausentes; runs upsert por (project,run_id).

export interface SyncInserted {
  commits: number;
  branches: number;
  runs: number;
}

export type SyncResult =
  | { ok: true; inserted: SyncInserted; lastSeenSha: string | null }
  | {
      ok: false;
      error: "project_not_found" | "not_connected" | "github_error";
    };

export async function syncProject(
  projectId: string,
  client?: GitHubClient,
): Promise<SyncResult> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, error: "project_not_found" };

  // `client` não injetado → resolve o token do DONO (cifrado no banco); sem conexão ou
  // token inválido → not_connected (sem rede). Em teste sempre injetamos o stub.
  let gh: GitHubClient;
  if (client === undefined) {
    const resolved = await resolveUserToken(project.userId);
    if (!resolved.ok) return { ok: false, error: "not_connected" };
    gh = createGitHubClient(resolved.token);
  } else {
    gh = client;
  }

  const ref = { owner: project.owner, repo: project.repo };
  try {
    const { name, defaultBranch } = await gh.getRepo(ref);

    // 1) Commits — dedupe por (project, sha). `since` avança a janela; `sha` fixa a branch.
    const ghCommits = await gh.listCommits({
      ...ref,
      since: project.lastPolledAt?.toISOString(),
      sha: defaultBranch,
    });
    const commitRows = ghCommits.map(mapCommit).map((c) => ({
      projectId,
      sha: c.sha,
      message: c.message,
      author: c.author,
      isMerge: c.isMerge,
      committedAt: c.committedAt,
    }));
    // SHAs já no banco ANTES do insert → os realmente novos viram evento `commit.created`.
    // (Idempotência da emissão: re-sync não reemite, mesmo com o stub ignorando `since`.)
    const existingShas = new Set(
      (
        await db.commit.findMany({
          where: { projectId, sha: { in: commitRows.map((c) => c.sha) } },
          select: { sha: true },
        })
      ).map((row) => row.sha),
    );
    const insertedCommits = (
      await db.commit.createMany({ data: commitRows, skipDuplicates: true })
    ).count;
    const commitEvents: EventInput[] = commitRows
      .filter((c) => !existingShas.has(c.sha))
      .map((c) =>
        commitToEvent(projectId, project.repo, defaultBranch, {
          sha: c.sha,
          message: c.message,
          author: c.author,
          isMerge: c.isMerge,
          committedAt: c.committedAt,
        }),
      );

    // 2) Branches — upsert por (project, name); marca a default; remove as sumidas.
    const ghBranches = await gh.listBranches(ref);
    for (const b of ghBranches) {
      const isDefault = b.name === defaultBranch;
      await db.branch.upsert({
        where: { projectId_name: { projectId, name: b.name } },
        update: { commitSha: b.commit.sha, isDefault },
        create: { projectId, name: b.name, commitSha: b.commit.sha, isDefault },
      });
    }
    const incomingNames = ghBranches.map((b) => b.name);
    await db.branch.deleteMany({
      where: { projectId, name: { notIn: incomingNames } },
    });

    // 3) Workflow runs — upsert por (project, run_id). run_id estoura int32 → BigInt.
    //    findUnique ANTES do upsert p/ decidir o evento: `ci.run` só na transição p/ `completed`
    //    (o upsert sobrescreveria o status anterior que `shouldEmitRunEvent` precisa ler).
    const ghRuns = await gh.listWorkflowRuns(ref);
    const runEvents: EventInput[] = [];
    for (const r of ghRuns) {
      const prev = await db.workflowRun.findUnique({
        where: { projectId_runId: { projectId, runId: BigInt(r.id) } },
        select: { status: true },
      });
      if (shouldEmitRunEvent(prev, { status: r.status })) {
        runEvents.push(runToEvent(projectId, r));
      }
      const fields = {
        name: r.name,
        headBranch: r.head_branch,
        headSha: r.head_sha,
        status: r.status,
        conclusion: r.conclusion,
        runNumber: r.run_number,
        htmlUrl: r.html_url,
        runStartedAt: r.run_started_at ? new Date(r.run_started_at) : null,
        updatedAt: new Date(r.updated_at),
      };
      await db.workflowRun.upsert({
        where: { projectId_runId: { projectId, runId: BigInt(r.id) } },
        update: fields,
        create: { projectId, runId: BigInt(r.id), ...fields },
      });
    }

    // 4) Cursor + metadados: HEAD da branch padrão vira lastSeenSha; lastPolledAt avança.
    const headSha =
      ghBranches.find((b) => b.name === defaultBranch)?.commit.sha ??
      project.lastSeenSha ??
      null;
    await db.project.update({
      where: { id: projectId },
      data: {
        name,
        defaultBranch,
        lastSeenSha: headSha,
        lastPolledAt: new Date(),
      },
    });

    // Eventos da Timeline (spec 012): `commit.created` (novos) + `ci.run` (concluídos). Sem
    // transação/PUBLISH aqui — o wrapper transacional + PUBLISH goals:updates entra na 014.
    const eventInputs = [...commitEvents, ...runEvents];
    if (eventInputs.length > 0) {
      await db.event.createMany({
        data: eventInputs.map((e) => ({
          source: e.source,
          type: e.type,
          refId: e.refId,
          projectId: e.projectId,
          title: e.title,
          detail: e.detail,
          visibleToClient: e.visibleToClient,
          createdAt: e.createdAt,
        })),
      });
    }
    return {
      ok: true,
      inserted: {
        commits: insertedCommits,
        branches: ghBranches.length,
        runs: ghRuns.length,
      },
      lastSeenSha: headSha,
    };
  } catch (error) {
    // Erro de borda do GitHub (rede/HTTP) é esperado e mapeado; o resto sobe.
    if (error instanceof GitHubError)
      return { ok: false, error: "github_error" };
    throw error;
  }
}
