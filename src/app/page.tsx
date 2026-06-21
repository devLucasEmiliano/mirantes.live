import { PublicHeader } from "@/components/layout/public-header";
import { GoalsList } from "@/components/shared/goals-list";
import PixelBlast from "@/components/shared/pixel-blast";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { TimelineFeed } from "@/components/shared/timeline-feed";
import { UptimePanel } from "@/components/shared/uptime-panel";
import { listPublicEvents } from "@/lib/events";
import { formatWeeklyDelta } from "@/lib/github/map";
import { toGoalDTO } from "@/lib/goals/dto";
import { listPublicGoals } from "@/lib/goals/service";
import { summarizeGoals } from "@/lib/goals/summary";
import { readHomeSnapshot } from "@/lib/home-snapshot";
import {
  listPublicProjects,
  publicWeeklyCommitStats,
} from "@/lib/projects/public";
import {
  PUBLIC_PROJECT_COOKIE,
  pickPublicProject,
  publicSlug,
} from "@/lib/projects/public-select";

// Home pública `/` (spec 016): IGUAL à Visão Geral (`/dashboard`), porém PÚBLICA e só-leitura.
// Cards/metas/timeline REAIS do projeto público SELECIONADO (URL `?projeto=` > cookie > mais
// antigo), com seletor dos públicos (qualquer dono). Sem sidebar, sem ações de edição. Só
// `UptimePanel` segue mock (igual ao `/dashboard`). force-dynamic: lê cookie/searchParam + DB.
export const dynamic = "force-dynamic";

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

/** ISO AAAA-MM-DD → "D Mês" (mesmo padrão do /dashboard); "—" quando não há data. */
function formatDue(isoDate: string | null): string {
  if (isoDate === null) return "—";
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS_PT[(month ?? 1) - 1]}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ projeto?: string }>;
}) {
  const [snapshot, { projeto }, projects] = await Promise.all([
    readHomeSnapshot(),
    searchParams,
    listPublicProjects().catch(() => []),
  ]);

  // Seleção pública sem I/O extra: já temos a lista; o cookie é lido aqui (Server Component).
  const { cookies } = await import("next/headers");
  const cookieId = (await cookies()).get(PUBLIC_PROJECT_COOKIE)?.value ?? null;
  const selected = pickPublicProject(projects, projeto ?? null, cookieId);

  const switcherItems = projects.map((p) => ({
    id: p.id,
    name: p.name,
    slug: publicSlug(p),
  }));

  const header = (
    <PublicHeader
      projectName={snapshot.projectName}
      tagline={snapshot.tagline}
      live={snapshot.live}
      updatedAt={snapshot.updatedAt}
      projects={switcherItems}
      selectedId={selected?.id ?? null}
    />
  );

  // Sem projeto público → casca + estado vazio (nada a mostrar a um visitante anônimo).
  if (!selected) {
    return (
      <Shell header={header}>
        <div className="relative z-10 flex flex-1 items-center justify-center px-10 py-20">
          <p className="font-body text-sm text-foreground-muted">
            Nenhum projeto público ainda. Um administrador pode tornar um
            projeto público em Integrações.
          </p>
        </div>
      </Shell>
    );
  }

  const [derived, weekly, events] = await Promise.all([
    listPublicGoals(selected.id),
    publicWeeklyCommitStats(selected.id),
    listPublicEvents(selected.id, 7),
  ]);
  const summary = summarizeGoals(derived);
  const goals = derived.map(toGoalDTO);
  const { done, total } = summary;
  const weeklyDelta = formatWeeklyDelta(weekly.count, weekly.previousCount);

  return (
    <Shell header={header}>
      <div className="relative z-10 flex gap-5 px-10 py-6">
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

      <div className="relative z-10 flex flex-1 gap-6 px-10 pb-8">
        <GoalsList goals={goals.slice(0, 3)} />
        <div className="w-[400px] shrink-0">
          <TimelineFeed events={events} />
        </div>
        <div className="w-[340px] shrink-0">
          <UptimePanel />
        </div>
      </div>
    </Shell>
  );
}

/** Casca visual da vitrine: fundo PixelBlast + header público, sem sidebar. */
function Shell({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden bg-surface-primary">
      {/* Fundo WebGL decorativo (PixelBlast). Camada absoluta atrás do conteúdo (z-10). */}
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

      {header}
      {children}
    </div>
  );
}
