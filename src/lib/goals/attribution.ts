// Orquestrador da atribuição automática commit→meta (spec 013; LLM removido na spec 016). Roda
// dentro do `syncProject`, só nos commits NOVOS. Para cada commit: resolve o determinístico
// (keyword `M-12` → branch vinculada → vínculo manual); sem match → não atribui. Aplica o peso de
// forma IDEMPOTENTE (unique commit_id+goal_id) e devolve os eventos `goal.*` p/ o pipeline do sync.
import type { Goal } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { EventInput } from "@/lib/events/emit";
import { applyWeight } from "./derive";
import { goalToEvent } from "./emit";
import { type CandidateGoal, resolveDeterministic } from "./resolver";

export interface AttributableCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  isMerge: boolean;
  committedAt: Date;
  branch: string;
}

type AttribMethod = "keyword" | "branch" | "manual";

export async function attributeCommits(
  projectId: string,
  newCommits: AttributableCommit[],
): Promise<EventInput[]> {
  if (newCommits.length === 0) return [];

  // Candidatas = folhas ATIVAS do projeto (metas-pai derivam; não recebem commit direto).
  const leaves = await db.goal.findMany({
    where: {
      projectId,
      deletedAt: null,
      children: { none: { deletedAt: null } },
    },
  });
  if (leaves.length === 0) return [];

  const candidates: CandidateGoal[] = leaves.map((g) => ({
    id: g.id,
    shortCode: g.shortCode,
    title: g.title,
    description: g.description,
  }));
  const leafIds = new Set(leaves.map((g) => g.id));
  const branchLinks = await db.goalBranchLink.findMany({
    where: { projectId },
    select: { branchName: true, goalId: true },
  });

  const events: EventInput[] = [];

  for (const c of newCommits) {
    // Atribuição 100% determinística: keyword (M-12) → branch vinculada → manual.
    const hint = resolveDeterministic(
      { message: c.message, branch: c.branch, isMerge: c.isMerge },
      { candidates, branchLinks },
    );
    if (!hint) continue; // sem match determinístico → não atribui
    const { goalId, method } = hint; // method ∈ "keyword" | "branch" | "manual"
    if (!leafIds.has(goalId)) continue;

    const weight = c.isMerge ? env.GOAL_WEIGHT_MERGE : env.GOAL_WEIGHT_COMMIT;
    const applied = await applyWeightIdempotent(c.id, goalId, weight, method);
    if (applied) {
      events.push(
        goalToEvent(
          applied.goal,
          applied.completed ? "completed" : "updated",
          c.committedAt ?? new Date(),
        ),
      );
    }
  }

  return events;
}

/**
 * Liga 1 commit a 1 meta e aplica o peso UMA vez. `createMany(skipDuplicates)` na unique
 * `(commit_id, goal_id)` é o anti double-count: count===0 → já aplicado (re-sync) → no-op.
 * Move `current_value` só em meta medível (X→Y); ao atingir o alvo → `done` + `completedAt`.
 */
async function applyWeightIdempotent(
  commitId: string,
  goalId: string,
  weight: number,
  method: AttribMethod,
): Promise<{ goal: Goal; completed: boolean } | null> {
  const { count } = await db.commitGoalLink.createMany({
    data: [{ commitId, goalId, weight, method }],
    skipDuplicates: true,
  });
  if (count === 0) return null; // já aplicado (re-sync)

  const leaf = await db.goal.findUnique({ where: { id: goalId } });
  // Meta manual (sem alvo) registra o vínculo mas não tem X→Y p/ avançar — sem evento.
  if (!leaf || leaf.targetValue === null) return null;

  const next = applyWeight(
    leaf.startValue ?? 0,
    leaf.targetValue,
    leaf.currentValue ?? leaf.startValue ?? 0,
    weight,
  );
  const done = next === leaf.targetValue;
  const goal = await db.goal.update({
    where: { id: goalId },
    data: {
      currentValue: next,
      status: done ? "done" : "in_progress",
      completedAt: done ? new Date() : null,
    },
  });
  await db.commitGoalLink.update({
    where: { commitId_goalId: { commitId, goalId } },
    data: { appliedValue: next },
  });
  return { goal, completed: done };
}
