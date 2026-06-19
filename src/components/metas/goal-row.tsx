import { StatusBadge } from "@/components/shared/status-badge";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GoalRowProps {
  goal: Goal;
  /** Slot do chevron (página de Metas usa expandir/recolher). */
  chevron?: React.ReactNode;
  /** Exibe a coluna de data prevista (oculta no componente do design). */
  showDue?: boolean;
  /** Linha-filha: título menor e sem negrito, indentada. */
  subdued?: boolean;
  className?: string;
}

/**
 * Linha de meta (componente "Goal Row" do design): chevron, título,
 * badge de status, barra de progresso 80px, percentual mono.
 */
export function GoalRow({
  goal,
  chevron,
  showDue,
  subdued,
  className,
}: GoalRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 py-2.5 pr-4",
        subdued ? "pl-12" : "pl-4",
        className,
      )}
    >
      <span className="flex size-5 items-center justify-center">{chevron}</span>
      {goal.shortCode && (
        <span className="shrink-0 font-mono text-[11px] text-foreground-muted">
          {goal.shortCode}
        </span>
      )}
      <span
        className={cn(
          "flex-1 truncate text-foreground-primary",
          subdued ? "text-[13px] font-normal" : "text-sm font-semibold",
        )}
      >
        {goal.title}
      </span>
      {goal.targetValue != null && (
        <span className="shrink-0 font-mono text-[11px] text-foreground-muted">
          {goal.currentValue ?? 0}/{goal.targetValue}
        </span>
      )}
      <StatusBadge
        status={goal.status}
        overdue={goal.overdue}
        className="w-[108px]"
      />
      <span className="h-[5px] w-20 overflow-hidden rounded-full bg-surface-elevated">
        <span
          className="block h-full rounded-full bg-accent-secondary"
          style={{ width: `${goal.percent ?? goal.progress}%` }}
        />
      </span>
      <span className="w-[38px] text-right font-mono text-xs text-foreground-primary">
        {goal.percent ?? goal.progress}%
      </span>
      {showDue && (
        <span
          className={cn(
            "w-14 text-right font-body text-[11px]",
            goal.overdue ? "text-status-overdue" : "text-foreground-muted",
          )}
        >
          {formatDue(goal.dueDate)}
        </span>
      )}
    </div>
  );
}

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatDue(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS_PT[(month ?? 1) - 1]}`;
}
