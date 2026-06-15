import { Calendar, ChevronDown, X } from "lucide-react";
import { GOAL_STATUS_LABELS, type Goal } from "@/lib/types";

const STATUS_DOT: Record<Goal["status"], string> = {
  todo: "bg-status-todo",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
};

interface GoalDetailPanelProps {
  goal: Goal;
  parentTitle?: string;
  onClose?: () => void;
}

/**
 * Painel lateral "Detalhes da Meta" (380px). Somente exibição:
 * os botões Salvar/Arquivar são visuais — a mutação real virá
 * com a spec de CRUD de metas.
 */
export function GoalDetailPanel({
  goal,
  parentTitle,
  onClose,
}: GoalDetailPanelProps) {
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
        <span className="text-base font-semibold text-foreground-primary">
          {goal.title}
        </span>
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${STATUS_DOT[goal.status]}`} />
          <span className="font-body text-[13px] text-foreground-primary">
            {GOAL_STATUS_LABELS[goal.status]}
          </span>
          <ChevronDown className="size-3.5 text-foreground-muted" />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-body text-xs text-foreground-muted">
            Progresso
          </span>
          <span className="h-2 overflow-hidden rounded-[4px] bg-surface-elevated">
            <span
              className="block h-full rounded-[4px] bg-accent-secondary"
              style={{ width: `${goal.progress}%` }}
            />
          </span>
          <span className="font-mono text-[13px] text-foreground-primary">
            {goal.progress}%
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

      <div className="flex flex-col gap-3 border-t border-border-subtle p-5">
        <span className="font-body text-xs tracking-[1px] text-foreground-muted">
          ATIVIDADE RECENTE
        </span>
        <ActivityEntry
          dotClass="bg-accent-secondary"
          text={`Progresso: ${Math.max(goal.progress - 15, 0)}% → ${goal.progress}%`}
          time="Hoje, 11:15"
        />
        <ActivityEntry
          dotClass="bg-status-in-progress"
          text="Status: Pendente → Em Progresso"
          time="28 Mai"
        />
        <ActivityEntry
          dotClass="bg-status-todo"
          text="Meta criada"
          time="20 Mai"
        />
      </div>

      <div className="flex gap-2 border-t border-border-subtle p-5">
        <button
          type="button"
          className="rounded-sm bg-accent-primary px-4 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
        >
          Salvar Alterações
        </button>
        <button
          type="button"
          className="rounded-sm border border-border-subtle px-4 py-2.5 text-[13px] text-status-overdue transition-colors hover:bg-surface-elevated"
        >
          Arquivar
        </button>
      </div>
    </aside>
  );
}

function ActivityEntry({
  dotClass,
  text,
  time,
}: {
  dotClass: string;
  text: string;
  time: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-1.5 shrink-0 rounded-full ${dotClass}`} />
      <span className="text-xs text-foreground-primary">{text}</span>
      <span className="flex-1" />
      <span className="shrink-0 font-body text-[11px] text-foreground-muted">
        {time}
      </span>
    </span>
  );
}
