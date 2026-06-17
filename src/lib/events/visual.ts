import type { TimelineEvent } from "@/lib/types";

// Categoria visual de um evento da Timeline (PURO, unit-testável). Os componentes mapeiam a
// categoria → {ícone lucide, cor}; aqui só decidimos a categoria a partir de `type`/`source`.
// Mantém a regra fora dos componentes (CLAUDE.md §7 + DOC.md de components/*) e sem lucide/JSX
// na lib. Antes, os mappers checavam `source === "commit"` primeiro e commit/CI caíam no MESMO
// ícone (runToEvent também usa source:"commit"); aqui o `type` manda → commit ≠ merge ≠ CI.
export type EventVisualKind =
  | "commit"
  | "merge"
  | "ci"
  | "goal-created"
  | "goal-completed"
  | "incident-open"
  | "incident-resolved"
  | "generic";

export function eventVisualKind(event: TimelineEvent): EventVisualKind {
  switch (event.type) {
    case "commit.merged":
      return "merge";
    case "commit.created":
      return "commit";
    case "ci.run":
      return "ci";
    case "goal.completed":
      return "goal-completed";
    case "goal.created":
      return "goal-created";
    case "incident.opened":
      return "incident-open";
    case "incident.resolved":
      return "incident-resolved";
    default:
      // Incidente de outro tipo cai no "resolvido" (verde); o resto é genérico.
      return event.source === "incident" ? "incident-resolved" : "generic";
  }
}
