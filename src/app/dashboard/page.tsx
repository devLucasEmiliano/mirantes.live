import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { GoalsList } from "@/components/shared/goals-list";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { TimelineFeed } from "@/components/shared/timeline-feed";
import { UptimePanel } from "@/components/shared/uptime-panel";
import { formatWeeklyDelta } from "@/lib/github/map";
import { mockEvents, mockGoals, mockSummary } from "@/lib/mock-data";
import { latestCommit, weeklyCommitStats } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Visão Geral — Mirantes.Live",
};

/** Tempo relativo (server-render) p/ o bloco de último commit. */
function relativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export default async function DashboardPage() {
  const done = mockSummary.completedGoals;
  const total = mockSummary.totalGoals;

  // Reais (spec 008): card "Commits da Semana" + bloco "último commit". Resto segue mock.
  const [weekly, latest] = await Promise.all([
    weeklyCommitStats(),
    latestCommit(),
  ]);
  const weeklyDelta = formatWeeklyDelta(weekly.count, weekly.previousCount);

  return (
    <>
      <AppHeader title="Visão Geral" breadcrumb="Dashboard / Visão Geral" />

      <div className="flex gap-5 px-8 py-6">
        <StatCard title="Progresso Total" className="items-center gap-3.5">
          <ProgressRing
            value={mockSummary.totalProgress}
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
              style={{ width: `${(done / total) * 100}%` }}
            />
            <span className="flex-1 bg-surface-elevated" />
          </span>
        </StatCard>

        <StatCard title="Em Andamento">
          <span className="font-mono text-[32px] font-bold leading-none text-accent-secondary">
            {mockSummary.inProgressGoals}
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-status-in-progress" />
              <span className="font-body text-xs text-foreground-muted">
                {mockSummary.inProgressGoals} em andamento
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-status-todo" />
              <span className="font-body text-xs text-foreground-muted">
                2 a fazer
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
            {mockSummary.overdueGoals}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            próx. vencimento: {mockSummary.nextDueDate}
          </span>
        </StatCard>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8">
        <GoalsList goals={mockGoals.slice(0, 3)} />
        <div className="flex w-[300px] shrink-0 flex-col gap-6">
          {latest && (
            <div className="flex flex-col gap-2 rounded-sm bg-surface-card p-5">
              <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
                Último commit sincronizado
              </span>
              <span className="font-mono text-xs text-accent-primary">
                {latest.sha.slice(0, 7)}
              </span>
              <span className="line-clamp-2 text-[13px] text-foreground-primary">
                {latest.message}
              </span>
              <span className="font-body text-[11px] text-foreground-muted">
                {latest.author} · {relativeTime(latest.committedAt)}
              </span>
            </div>
          )}
          <TimelineFeed
            events={mockEvents.filter((e) => e.source === "goal").slice(0, 7)}
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
