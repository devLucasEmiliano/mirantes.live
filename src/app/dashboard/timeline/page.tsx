import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { TimelineView } from "@/components/timeline/timeline-view";
import { requireUser } from "@/lib/auth/session";
import { listEvents, weeklyEventStats } from "@/lib/events";
import { scopeForUser } from "@/lib/projects";
import { resolveSelectedProject } from "@/lib/projects/select";

export const metadata: Metadata = {
  title: "Timeline — Mirantes.Live",
};

// Timeline real (spec 012): lê `events` do escopo, filtrada pelo projeto selecionado (cookie;
// fallback = mais antigo). Não é AO VIVO ainda — relê a cada carga/navegação (SSE = spec 014).
export default async function TimelinePage() {
  const scope = scopeForUser(await requireUser());
  const selected = await resolveSelectedProject(scope);
  const projectId = selected?.id;
  const [{ events, nextCursor }, weekSummary] = await Promise.all([
    listEvents(scope, { projectId, limit: 30 }),
    weeklyEventStats(scope, projectId),
  ]);

  return (
    <>
      <AppHeader title="Timeline" breadcrumb="Dashboard / Timeline" />
      <TimelineView
        key={projectId ?? "all"}
        events={events}
        nextCursor={nextCursor}
        projectId={projectId}
        nowIso={new Date().toISOString()}
        weekSummary={weekSummary}
      />
    </>
  );
}
