import { PublicHeader } from "@/components/layout/public-header";
import { GoalsList } from "@/components/shared/goals-list";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { TimelineFeed } from "@/components/shared/timeline-feed";
import { UptimePanel } from "@/components/shared/uptime-panel";
import { mockEvents, mockGoals, mockSummary } from "@/lib/mock-data";

/**
 * Home pública: visão geral do projeto sem sidebar (PRD — página de
 * progresso visível antes do login).
 */
export default function HomePage() {
  const { totalGoals, completedGoals, inProgressGoals } = mockSummary;
  const todoGoals = totalGoals - completedGoals - inProgressGoals;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-primary">
      <PublicHeader />

      <div className="flex gap-5 px-10 py-6">
        <StatCard title="Total de Metas">
          <span className="font-mono text-[32px] font-bold leading-none text-foreground-primary">
            {totalGoals}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            metas registradas
          </span>
          <span className="mt-auto flex h-1.5 overflow-hidden rounded-[3px]">
            <span
              className="bg-status-done"
              style={{ width: `${(completedGoals / totalGoals) * 100}%` }}
            />
            <span
              className="bg-status-in-progress"
              style={{ width: `${(inProgressGoals / totalGoals) * 100}%` }}
            />
            <span
              className="bg-surface-elevated"
              style={{ width: `${(todoGoals / totalGoals) * 100}%` }}
            />
          </span>
        </StatCard>

        <StatCard title="Saúde do Projeto" className="items-center">
          <ProgressRing
            value={mockSummary.health}
            color="var(--color-status-done)"
          />
          <span className="font-body text-xs text-foreground-muted">
            índice de saúde
          </span>
        </StatCard>

        <StatCard title="Commits Semanais">
          <span className="font-mono text-[32px] font-bold leading-none text-accent-primary">
            {mockSummary.weeklyCommits}
          </span>
          <span className="font-body text-xs text-status-done">
            {mockSummary.weeklyCommitsDelta}
          </span>
        </StatCard>

        <StatCard title="Tempo Médio">
          <span className="font-mono text-[32px] font-bold leading-none text-accent-secondary">
            {mockSummary.avgCompletionDays}d
          </span>
          <span className="font-body text-xs text-foreground-muted">
            dias para concluir meta
          </span>
        </StatCard>
      </div>

      <div className="flex flex-1 gap-6 px-10 pb-8">
        <GoalsList goals={mockGoals.slice(0, 3)} />
        <div className="w-[400px] shrink-0">
          <TimelineFeed
            events={mockEvents.filter((e) => e.source === "goal").slice(0, 7)}
          />
        </div>
        <div className="w-[340px] shrink-0">
          <UptimePanel />
        </div>
      </div>
    </div>
  );
}
