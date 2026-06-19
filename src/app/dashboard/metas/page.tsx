import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { MetasView } from "@/components/metas/metas-view";
import { requireUser } from "@/lib/auth/session";
import { toGoalDTO } from "@/lib/goals/dto";
import { listGoals } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";
import { resolveSelectedProject } from "@/lib/projects/select";

export const metadata: Metadata = {
  title: "Metas — Mirantes.Live",
};

// Metas REAIS (spec 013): árvore derivada do ESCOPO, filtrada pelo projeto selecionado (cookie;
// fallback = mais antigo). Sem mais `mockGoals`. Só admin muta (botões via `canMutate`).
export default async function MetasPage() {
  const user = await requireUser();
  const scope = scopeForUser(user);
  const selected = await resolveSelectedProject(scope);
  const goals = (await listGoals(scope, selected?.id)).map(toGoalDTO);

  return (
    <>
      <AppHeader title="Metas" breadcrumb="Dashboard / Metas" />
      <MetasView goals={goals} canMutate={user.role === "admin"} />
    </>
  );
}
