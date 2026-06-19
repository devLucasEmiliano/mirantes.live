import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { GoalForm } from "@/components/metas/goal-form";
import { requireUser } from "@/lib/auth/session";
import { toGoalDTO } from "@/lib/goals/dto";
import { listGoals } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";
import { resolveSelectedProject } from "@/lib/projects/select";
import type { Goal } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nova Meta — Mirantes.Live",
};

// Achata a árvore de metas em opções planas de meta-pai (prefixadas pelo short code).
function flatten(goals: Goal[], depth = 0): { id: string; label: string }[] {
  return goals.flatMap((g) => [
    {
      id: g.id,
      label: `${"— ".repeat(depth)}${g.shortCode ? `${g.shortCode} · ` : ""}${g.title}`,
    },
    ...flatten(g.children ?? [], depth + 1),
  ]);
}

export default async function NovaMetaPage() {
  const user = await requireUser();
  const scope = scopeForUser(user);
  const selected = await resolveSelectedProject(scope);
  const goals = selected
    ? (await listGoals(scope, selected.id)).map(toGoalDTO)
    : [];

  return (
    <>
      <AppHeader title="Nova Meta" breadcrumb="Dashboard / Metas / Nova Meta" />
      <div className="flex flex-1 flex-col items-center p-8">
        <GoalForm projectId={selected?.id ?? null} parents={flatten(goals)} />
      </div>
    </>
  );
}
