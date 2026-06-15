import { GOAL_STATUS_LABELS, type GoalStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<GoalStatus, string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
};

interface StatusBadgeProps {
  status: GoalStatus;
  /** Atrasada sobrepõe a cor e o rótulo (PRD §4.5). */
  overdue?: boolean;
  className?: string;
}

export function StatusBadge({ status, overdue, className }: StatusBadgeProps) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "size-2 rounded-full",
          overdue ? "bg-status-overdue" : STATUS_DOT[status],
        )}
      />
      <span
        className={cn(
          "font-body text-[11px]",
          overdue ? "text-status-overdue" : "text-foreground-muted",
        )}
      >
        {overdue ? "Atrasada" : GOAL_STATUS_LABELS[status]}
      </span>
    </span>
  );
}
