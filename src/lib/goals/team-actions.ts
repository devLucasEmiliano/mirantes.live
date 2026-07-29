"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { listTeamProjectIdsForUser } from "@/lib/teams";
import { METAS_TEAM_PROJECT_COOKIE } from "./team-select";

// Server Action da seção "Metas de equipe" (spec 022). Arquivo "use server" dedicado (mesmo
// padrão de `projects/actions.ts`) — o switcher (client) importa `selectMetasTeamProject` como
// referência RPC, sem bundlar `@/lib/teams`/Prisma para o browser.

/**
 * Troca o projeto da seção "Metas de equipe". Valida o PERTENCIMENTO via
 * `listTeamProjectIdsForUser` (alheio/inexistente → no-op, não grava) e persiste a escolha
 * no cookie `metas_team_project_id` (httpOnly, SameSite=Lax, path:/, 1 ano).
 */
export async function selectMetasTeamProject(projectId: string): Promise<void> {
  const current = await getCurrentUser();
  if (!current) return;
  const ids = await listTeamProjectIdsForUser(current.id);
  if (!ids.includes(projectId)) return;
  const store = await cookies();
  store.set(METAS_TEAM_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
