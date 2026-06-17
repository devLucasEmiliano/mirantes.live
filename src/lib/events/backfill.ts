import { db } from "@/lib/db";
import { commitToEvent, type EventInput, runToEvent } from "./emit";

// Backfill dos commits/runs que já nasceram no banco ANTES da spec 012 (p/ a timeline não
// começar vazia). Idempotente: dedupe por (projectId, refId). Insere em ordem ASCENDENTE de
// tempo → ids cronológicos (âncora do SSE, spec 014). Rodado pelo seed e2e (e por `bun run`).

function key(projectId: string | null, refId: string | null): string {
  return `${projectId}:${refId}`;
}

export async function backfillEvents(): Promise<{
  commits: number;
  runs: number;
}> {
  // 1) commit.created p/ cada commit sem evento (dedupe por projectId+sha).
  const seenCommits = new Set(
    (
      await db.event.findMany({
        where: { type: "commit.created" },
        select: { projectId: true, refId: true },
      })
    ).map((e) => key(e.projectId, e.refId)),
  );
  const commits = await db.commit.findMany({
    orderBy: { committedAt: "asc" },
    include: { project: { select: { repo: true } } },
  });
  const commitInputs: EventInput[] = commits
    .filter((c) => !seenCommits.has(key(c.projectId, c.sha)))
    .map((c) =>
      commitToEvent(c.projectId, c.project.repo, {
        sha: c.sha,
        message: c.message,
        author: c.author,
        committedAt: c.committedAt,
      }),
    );

  // 2) ci.run p/ cada run `completed` sem evento (dedupe por projectId+runId). Reusa
  //    runToEvent adaptando a linha do banco à forma GhWorkflowRun (Number(runId) é lossless).
  const seenRuns = new Set(
    (
      await db.event.findMany({
        where: { type: "ci.run" },
        select: { projectId: true, refId: true },
      })
    ).map((e) => key(e.projectId, e.refId)),
  );
  const runs = await db.workflowRun.findMany({
    where: { status: "completed" },
    orderBy: { updatedAt: "asc" },
  });
  const runInputs: EventInput[] = runs
    .filter((r) => !seenRuns.has(key(r.projectId, String(r.runId))))
    .map((r) =>
      runToEvent(r.projectId, {
        id: Number(r.runId),
        name: r.name,
        head_branch: r.headBranch,
        head_sha: r.headSha,
        run_number: r.runNumber,
        status: r.status,
        conclusion: r.conclusion,
        html_url: r.htmlUrl,
        run_started_at: r.runStartedAt ? r.runStartedAt.toISOString() : null,
        updated_at: r.updatedAt.toISOString(),
      }),
    );

  // Ordem ascendente de tempo no insert → ids cronológicos.
  const all = [...commitInputs, ...runInputs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  if (all.length > 0) {
    await db.event.createMany({
      data: all.map((e) => ({
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
  return { commits: commitInputs.length, runs: runInputs.length };
}
