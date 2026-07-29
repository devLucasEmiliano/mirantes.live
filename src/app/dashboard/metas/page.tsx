import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { MetasView } from "@/components/metas/metas-view";
import { TeamMetasSection } from "@/components/metas/team-metas-section";
import { requireUser } from "@/lib/auth/session";
import { toGoalDTO } from "@/lib/goals/dto";
import { listGoals } from "@/lib/goals/service";
import { resolveTeamProjectSelection } from "@/lib/goals/team-select";
import { scopeForUser } from "@/lib/projects";
import { resolveSelectedProject } from "@/lib/projects/select";
import { listTeamProjectsForUser } from "@/lib/teams";

export const metadata: Metadata = {
  title: "Metas — Mirantes.Live",
};

// Metas REAIS (spec 013): árvore derivada do ESCOPO, filtrada pelo projeto selecionado (cookie;
// fallback = mais antigo). Sem mais `mockGoals`. Só admin muta (botões via `canMutate`).
// Metas de EQUIPE (spec 022): seção independente abaixo, só p/ `client` — projeto/seletor
// PRÓPRIOS (não usa o cookie do header), árvore sempre read-only.
export default async function MetasPage() {
  const user = await requireUser();
  const scope = scopeForUser(user);
  const selected = await resolveSelectedProject(scope);
  const goals = (await listGoals(scope, selected?.id)).map(toGoalDTO);

  let teamProjects: { id: string; name: string }[] = [];
  let selectedTeamProjectId: string | undefined;
  let teamGoals: ReturnType<typeof toGoalDTO>[] = [];
  if (scope.role === "client") {
    const projects = await listTeamProjectsForUser(user.id);
    teamProjects = projects;
    const selectedTeam = await resolveTeamProjectSelection(user.id);
    selectedTeamProjectId = selectedTeam?.id;
    teamGoals = selectedTeam
      ? (await listGoals(scope, selectedTeam.id)).map(toGoalDTO)
      : [];
  }

  return (
    <>
      <AppHeader title="Metas" breadcrumb="Dashboard / Metas" />
      <MetasView goals={goals} canMutate={user.role === "admin"} />
      <TeamMetasSection
        teamProjects={teamProjects}
        selectedProjectId={selectedTeamProjectId}
        goals={teamGoals}
      />
    </>
  );
}
