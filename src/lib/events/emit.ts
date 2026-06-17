import type { GhWorkflowRun } from "@/lib/github/client";
import { deriveRunStatus, type MappedCommit } from "@/lib/github/map";

// Mapeadores puros (unit-testáveis): convertem commit/run do GitHub em ENTRADA de evento
// (`EventInput`) e decidem QUANDO o CI vira evento. Sem I/O — o `createMany` mora no sync.

/** Linha pronta p/ inserir em `events` (antes de tocar o banco). */
export interface EventInput {
  source: string;
  type: string;
  refId: string | null;
  projectId: string | null;
  title: string;
  detail: string | null;
  visibleToClient: boolean;
  createdAt: Date;
}

/**
 * Limpa o título cru de um merge do GitHub. Puro. Cai p/ a mensagem original se não casar:
 * - "Merge pull request #5 from o/x"        → "Merge do PR #5"
 * - "Merge branch 'X' into Y"               → "Merge: 'X' → Y"  (sem "into Y" → "Merge: 'X'")
 * - "Merge remote-tracking branch 'a/b'"    → "Merge: a/b"      (tira refs/remotes/)
 */
export function mergeTitle(message: string): string {
  const pr = message.match(/^Merge pull request #(\d+)\b/);
  if (pr) return `Merge do PR #${pr[1]}`;
  const branch = message.match(/^Merge branch '([^']+)'(?: into (\S+))?/);
  if (branch) {
    return branch[2]
      ? `Merge: '${branch[1]}' → ${branch[2]}`
      : `Merge: '${branch[1]}'`;
  }
  const tracking = message.match(/^Merge remote-tracking branch '([^']+)'/);
  if (tracking) return `Merge: ${tracking[1].replace(/^refs\/remotes\//, "")}`;
  return message;
}

/**
 * 1 commit novo → 1 evento. Merge (2+ parents) vira `commit.merged` com título limpo
 * (`mergeTitle`); o resto, `commit.created` com o subject. `detail` = `autor · repo · branch`.
 * `createdAt` = quando o commit foi feito (não a descoberta).
 */
export function commitToEvent(
  projectId: string,
  repo: string,
  branch: string,
  c: MappedCommit,
): EventInput {
  return {
    source: "commit",
    type: c.isMerge ? "commit.merged" : "commit.created",
    refId: c.sha,
    projectId,
    title: c.isMerge ? mergeTitle(c.message) : c.message,
    detail: `${c.author} · ${repo} · ${branch}`,
    visibleToClient: true,
    createdAt: c.committedAt,
  };
}

/** Rótulo pt-BR da conclusão do run, derivado do estado normalizado (badge da UI). */
const CONCLUSION_LABELS: Record<string, string> = {
  success: "sucesso",
  failure: "falhou",
  cancelled: "cancelado",
};

export function runConclusionLabel(run: {
  status: string;
  conclusion: string | null;
}): string {
  return CONCLUSION_LABELS[deriveRunStatus(run)] ?? "concluído";
}

/** Duração humana de um run (fim − início): "45s" / "1m 23s" / "2m" / "1h 4m". "" sem início. Puro. */
export function formatRunDuration(
  startedAt: Date | null,
  endedAt: Date,
): string {
  if (!startedAt) return "";
  const sec = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) {
    const rest = sec % 60;
    return rest ? `${min}m ${rest}s` : `${min}m`;
  }
  const hours = Math.floor(min / 60);
  const restMin = min % 60;
  return restMin ? `${hours}h ${restMin}m` : `${hours}h`;
}

/**
 * 1 run ao CONCLUIR → 1 `ci.run`. Título `<workflow> #<n> · <conclusão>` (o "CI" sai — o ícone já
 * diz); detalhe `<branch> · <duração>`. `createdAt` = `updated_at` do GitHub (fim do run).
 */
export function runToEvent(projectId: string, run: GhWorkflowRun): EventInput {
  const ended = new Date(run.updated_at);
  const duration = formatRunDuration(
    run.run_started_at ? new Date(run.run_started_at) : null,
    ended,
  );
  const branch = run.head_branch ?? "—";
  return {
    source: "commit",
    type: "ci.run",
    refId: String(run.id),
    projectId,
    title: `${run.name} #${run.run_number} · ${runConclusionLabel(run)}`,
    detail: duration ? `${branch} · ${duration}` : branch,
    visibleToClient: true,
    createdAt: ended,
  };
}

/**
 * Emite `ci.run` só na TRANSIÇÃO p/ `completed`: incoming concluído E (run nova OU prev ainda
 * não concluída). Re-sync de run já `completed` → não reemite (idempotência por estado).
 */
export function shouldEmitRunEvent(
  prev: { status: string } | null,
  incoming: { status: string },
): boolean {
  return (
    incoming.status === "completed" &&
    (prev === null || prev.status !== "completed")
  );
}
