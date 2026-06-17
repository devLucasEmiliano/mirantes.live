import { PublicHeader } from "@/components/layout/public-header";
import { GoalsList } from "@/components/shared/goals-list";
import PixelBlast from "@/components/shared/pixel-blast";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { TimelineFeed } from "@/components/shared/timeline-feed";
import { UptimePanel } from "@/components/shared/uptime-panel";
import { listShowcaseEvents } from "@/lib/events";
import { readHomeSnapshot } from "@/lib/home-snapshot";
import { mockGoals, mockSummary } from "@/lib/mock-data";

// A home é servida a partir do snapshot público no Redis (SPEC §1/§4); o Postgres
// segue sendo a fonte de verdade do negócio. force-dynamic: lê o Redis a cada
// request (apagar a chave → fallback; re-seed → restaura). A "Atividade Recente" é
// REAL (vitrine = projeto mais antigo de um admin, só visível — spec 012); cards/metas/
// uptime seguem mock até as suas specs.
export const dynamic = "force-dynamic";

/**
 * Home pública: visão geral do projeto sem sidebar (PRD — página de
 * progresso visível antes do login).
 */
export default async function HomePage() {
  const snapshot = await readHomeSnapshot();
  const { totalGoals, completedGoals, inProgressGoals } = mockSummary;
  const todoGoals = totalGoals - completedGoals - inProgressGoals;
  // Feed real da vitrine (só `visibleToClient`); degrada p/ vazio se o Postgres falhar.
  const events = await listShowcaseEvents(7).catch(() => []);

  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-surface-primary">
      {/* Fundo WebGL decorativo (PixelBlast). Camada absoluta atrás de todo o
          conteúdo; o conteúdo abaixo fica em z-10 para receber os cliques. */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <PixelBlast
          variant="square"
          pixelSize={3}
          color="#b3b1b1"
          patternScale={4}
          patternDensity={1.25}
          pixelSizeJitter={0}
          enableRipples={false}
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.75}
          edgeFade={0.25}
          transparent
        />
      </div>

      <PublicHeader
        projectName={snapshot.projectName}
        tagline={snapshot.tagline}
        live={snapshot.live}
        updatedAt={snapshot.updatedAt}
      />

      <div className="relative z-10 flex gap-5 px-10 py-6">
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
          <TimelineFeed events={events} />
        </div>
        <div className="w-[340px] shrink-0">
          <UptimePanel />
        </div>
      </div>
    </div>
  );
}
