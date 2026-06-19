// Mapper PURO meta→evento (spec 013). Espelha o padrão de `events/emit.ts` (`*ToEvent`):
// sem I/O, alimenta o pipeline `events` já existente. `source:"goal"`, `visibleToClient`
// sempre true (metas são visíveis ao cliente). O detalhe carrega o short code + X/Y.
import type { EventInput } from "@/lib/events/emit";

export type GoalEventKind = "created" | "updated" | "completed" | "archived";

export interface GoalEventInput {
  id: string;
  projectId: string | null;
  shortCode: string;
  title: string;
  currentValue: number | null;
  targetValue: number | null;
}

export function goalToEvent(
  goal: GoalEventInput,
  kind: GoalEventKind,
  at: Date,
): EventInput {
  const detail =
    kind === "completed"
      ? `${goal.shortCode} · concluída`
      : goal.targetValue !== null
        ? `${goal.shortCode} · ${goal.currentValue ?? 0}/${goal.targetValue}`
        : goal.shortCode;
  return {
    source: "goal",
    type: `goal.${kind}`,
    refId: goal.id,
    projectId: goal.projectId,
    title: goal.title,
    detail,
    visibleToClient: true,
    createdAt: at,
  };
}
