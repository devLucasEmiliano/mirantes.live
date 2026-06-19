import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { GoalsList } from "@/components/shared/goals-list";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { TimelineFeed } from "@/components/shared/timeline-feed";
import { UptimePanel } from "@/components/shared/uptime-panel";
import { requireUser } from "@/lib/auth/session";
import { listEvents } from "@/lib/events";
import { formatWeeklyDelta } from "@/lib/github/map";
import { toGoalDTO } from "@/lib/goals/dto";
import { listGoals } from "@/lib/goals/service";
import { summarizeGoals } from "@/lib/goals/summary";
import { scopeForUser, weeklyCommitStats } from "@/lib/projects";
import { resolveSelectedProject } from "@/lib/projects/select";

export const metadata: Metadata = {
  title: "Visão Geral — Mirantes.Live",
};

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

/** ISO AAAA-MM-DD → "D Mês" (mesmo padrão do goal-row); "—" quando não há data. */
function formatDue(isoDate: string | null): string {
  if (isoDate === null) return "—";
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS_PT[(month ?? 1) - 1]}`;
}

export default async function DashboardPage() {
  // Reais (spec 008/012): "Commits da Semana" + "Atividade Recente"; reais (spec 013/014): metas
  // e resumo. Tudo ESCOPADO pelo papel e filtrado pelo projeto selecionado (cookie; fallback = mais
  // antigo). Só monitoramento (UptimePanel) segue mock — fora do escopo da 014.
  const scope = scopeForUser(await requireUser());
  const selected = await resolveSelectedProject(scope);
  const projectId = selected?.id;
  const [derived, weekly, recent] = await Promise.all([
    listGoals(scope, projectId),
    weeklyCommitStats(scope, projectId),
    listEvents(scope, { projectId, limit: 7 }),
  ]);
  const summary = summarizeGoals(derived);
  const goals = derived.map(toGoalDTO);
  const { done, total } = summary;
  const weeklyDelta = formatWeeklyDelta(weekly.count, weekly.previousCount);

  return (
    <>
      <AppHeader title="Visão Geral" breadcrumb="Dashboard / Visão Geral" />

      <div className="flex gap-5 px-8 py-6">
        <StatCard title="Progresso Total" className="items-center gap-3.5">
          <ProgressRing
            value={summary.totalProgress}
            color="var(--color-status-done)"
          />
          <span className="font-body text-xs text-foreground-muted">
            do projeto concluído
          </span>
        </StatCard>

        <StatCard title="Metas Concluídas">
          <span className="font-mono text-[32px] font-bold leading-none text-foreground-primary">
            {done}/{total}
          </span>
          <span className="mt-auto flex h-1.5 overflow-hidden rounded-[3px]">
            <span
              className="bg-status-done"
              style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
            />
            <span className="flex-1 bg-surface-elevated" />
          </span>
        </StatCard>

        <StatCard title="Em Andamento">
          <span className="font-mono text-[32px] font-bold leading-none text-accent-secondary">
            {summary.inProgress}
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-status-in-progress" />
              <span className="font-body text-xs text-foreground-muted">
                {summary.inProgress} em andamento
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-status-todo" />
              <span className="font-body text-xs text-foreground-muted">
                {summary.todo} a fazer
              </span>
            </span>
          </span>
        </StatCard>

        <StatCard title="Commits da Semana">
          <span className="font-mono text-[32px] font-bold leading-none text-foreground-primary">
            {weekly.count}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            {weeklyDelta}
          </span>
        </StatCard>

        <StatCard title="Metas Atrasadas">
          <span className="font-mono text-[32px] font-bold leading-none text-status-overdue">
            {summary.overdue}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            próx. vencimento: {formatDue(summary.nextDueDate)}
          </span>
        </StatCard>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8">
        <GoalsList goals={goals.slice(0, 3)} />
        <div className="flex w-[300px] shrink-0 flex-col gap-6">
          <TimelineFeed
            events={recent.events}
            seeAllHref="/dashboard/timeline"
          />
        </div>
        <div className="w-[260px] shrink-0">
          <UptimePanel />
        </div>
      </div>
    </>
  );
}
