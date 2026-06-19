// DTO PURO meta→JSON/UI (spec 013). Converte a `DerivedGoal` (com `Date` e campos só de
// derivação) no tipo `Goal` da UI (JSON-safe): `dueDate` vira `AAAA-MM-DD` e a árvore segue
// recursiva. Mesmo tipo serve REST, MCP e Server Components. Sem I/O.
import type { Goal } from "@/lib/types";
import type { DerivedGoal } from "./derive";

export type GoalDTO = Goal;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toGoalDTO(goal: DerivedGoal): Goal {
  return {
    id: goal.id,
    shortCode: goal.shortCode,
    projectId: goal.projectId ?? null,
    title: goal.title,
    description: goal.description ?? null,
    status: goal.status,
    progress: goal.progress,
    percent: goal.percent,
    dueDate: toDateOnly(goal.dueDate),
    overdue: goal.overdue,
    derived: goal.derived,
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    children: goal.children.map(toGoalDTO),
  };
}
