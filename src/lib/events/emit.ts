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

/** 1 commit novo → 1 `commit.created`. `createdAt` = quando o commit foi feito (não a descoberta). */
export function commitToEvent(
  projectId: string,
  repo: string,
  c: MappedCommit,
): EventInput {
  return {
    source: "commit",
    type: "commit.created",
    refId: c.sha,
    projectId,
    title: c.message,
    detail: `${c.author} · ${repo}`,
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

/** 1 run ao CONCLUIR → 1 `ci.run`. `createdAt` = `updated_at` do GitHub (fim do run). */
export function runToEvent(projectId: string, run: GhWorkflowRun): EventInput {
  return {
    source: "commit",
    type: "ci.run",
    refId: String(run.id),
    projectId,
    title: `CI ${run.name} #${run.run_number}: ${runConclusionLabel(run)}`,
    detail: `branch ${run.head_branch}`,
    visibleToClient: true,
    createdAt: new Date(run.updated_at),
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
