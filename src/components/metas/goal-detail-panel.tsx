import { Calendar, X } from "lucide-react";
import { GOAL_STATUS_LABELS, type Goal, type GoalStatus } from "@/lib/types";

const STATUS_DOT: Record<Goal["status"], string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
};

interface GoalDetailPanelProps {
  goal: Goal;
  parentTitle?: string;
  canMutate?: boolean;
  onClose?: () => void;
  onArchive?: () => void;
  onChangeStatus?: (status: GoalStatus) => void;
}

/**
 * Painel lateral "Detalhes da Meta" (380px). Spec 013: mostra short code, X→Y, commits
 * atribuídos. Admin (`canMutate`) edita status (folha) e arquiva; cliente é read-only.
 */
export function GoalDetailPanel({
  goal,
  parentTitle,
  canMutate = false,
  onClose,
  onArchive,
  onChangeStatus,
}: GoalDetailPanelProps) {
  const percent = goal.percent ?? goal.progress;
  const measurable = goal.targetValue != null;

  return (
    <aside className="flex w-[380px] shrink-0 flex-col self-start rounded-sm bg-surface-card">
      <div className="flex items-center justify-between border-b border-border-subtle p-5">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          Detalhes da Meta
        </h2>
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={onClose}
          className="text-foreground-muted transition-colors hover:text-foreground-primary"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <span className="flex items-center gap-2">
          {goal.shortCode && (
            <span className="font-mono text-xs text-foreground-muted">
              {goal.shortCode}
            </span>
          )}
          <span className="text-base font-semibold text-foreground-primary">
            {goal.title}
          </span>
        </span>

        {canMutate && !goal.derived ? (
          <label className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${STATUS_DOT[goal.status]}`}
            />
            <select
              aria-label="Status da meta"
              value={goal.status}
              onChange={(e) => onChangeStatus?.(e.target.value as GoalStatus)}
              className="rounded-sm border border-border-subtle bg-surface-primary px-2 py-1 text-[13px] text-foreground-primary outline-none focus:border-accent-primary"
            >
              <option value="todo">A Fazer</option>
              <option value="in_progress">Em Progresso</option>
              <option value="done">Concluído</option>
            </select>
          </label>
        ) : (
          <span className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${STATUS_DOT[goal.status]}`}
            />
            <span className="font-body text-[13px] text-foreground-primary">
              {GOAL_STATUS_LABELS[goal.status]}
              {goal.derived && " · derivado"}
            </span>
          </span>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="font-body text-xs text-foreground-muted">
            Progresso{" "}
            {measurable && (
              <span className="font-mono">
                ({goal.currentValue ?? 0}/{goal.targetValue})
              </span>
            )}
          </span>
          <span className="h-2 overflow-hidden rounded-[4px] bg-surface-elevated">
            <span
              className="block h-full rounded-[4px] bg-accent-secondary"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="font-mono text-[13px] text-foreground-primary">
            {percent}%
          </span>
        </div>

        <span className="flex items-center gap-2">
          <Calendar className="size-3.5 text-foreground-muted" />
          <span className="text-[13px] text-foreground-primary">
            {goal.dueDate.split("-").reverse().join("/")}
          </span>
        </span>
        {parentTitle && (
          <span className="font-body text-xs text-foreground-muted">
            Meta pai: {parentTitle}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-border-subtle p-5">
        <span className="font-body text-xs tracking-[1px] text-foreground-muted">
          DESCRIÇÃO
        </span>
        <p className="text-[13px] leading-relaxed text-foreground-primary">
          {goal.description ?? "Sem descrição."}
        </p>
      </div>

      {goal.attributedCommits && goal.attributedCommits.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-border-subtle p-5">
          <span className="font-body text-xs tracking-[1px] text-foreground-muted">
            COMMITS ATRIBUÍDOS
          </span>
          {goal.attributedCommits.map((c) => (
            <span key={c.sha} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-accent-secondary" />
              <span className="truncate text-xs text-foreground-primary">
                {c.message}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-foreground-muted">
                {c.sha.slice(0, 7)}
              </span>
            </span>
          ))}
        </div>
      )}

      {canMutate && (
        <div className="flex gap-2 border-t border-border-subtle p-5">
          <button
            type="button"
            onClick={onArchive}
            className="rounded-sm border border-border-subtle px-4 py-2.5 text-[13px] text-status-overdue transition-colors hover:bg-surface-elevated"
          >
            Arquivar
          </button>
        </div>
      )}
    </aside>
  );
}
