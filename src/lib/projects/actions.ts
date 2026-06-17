"use server";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject, scopeForUser } from "@/lib/projects";
import { SELECTED_PROJECT_COOKIE } from "./select";

// Server Actions de projeto. Arquivo "use server" dedicado (padrão Next p/ ações chamadas por
// Client Components — o switcher importa `selectProject` como referência RPC, sem bundlar server).

/**
 * Troca o projeto do contexto (header). Valida o PERTENCIMENTO via `getProject` (alheio/
 * inexistente → no-op, não grava) e persiste a escolha no cookie `selected_project_id`
 * (SameSite=Lax, path:/, 1 ano). A UI chama isto e em seguida `router.refresh()`.
 */
export async function selectProject(projectId: string): Promise<void> {
  const current = await getCurrentUser();
  if (!current) return;
  const result = await getProject(projectId, scopeForUser(current));
  if (!result.ok) return;
  const store = await cookies();
  store.set(SELECTED_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
