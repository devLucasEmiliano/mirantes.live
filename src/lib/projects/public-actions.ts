"use server";

import { cookies } from "next/headers";
import { getPublicProject } from "./public";
import { PUBLIC_PROJECT_COOKIE } from "./public-select";

// Server Action da home pública (spec 016). Memoriza no cookie o projeto público escolhido
// pelo seletor. Valida o limite (`getPublicProject`): projeto privado/inexistente → no-op.

/**
 * Grava o cookie `public_project_id` SE o projeto for público (limite de segurança); projeto
 * privado/inexistente → no-op silencioso. A UI chama isto e em seguida navega/`router.refresh()`.
 * O link `?projeto=` continua tendo prioridade na resolução (`pickPublicProject`).
 */
export async function selectPublicProject(projectId: string): Promise<void> {
  const project = await getPublicProject(projectId);
  if (!project) return;
  // O cookie é só MEMÓRIA (o link `?projeto=` é o mecanismo compartilhável e tem prioridade):
  // se não houver escopo de request p/ escrevê-lo, degrada em silêncio em vez de lançar.
  try {
    const store = await cookies();
    store.set(PUBLIC_PROJECT_COOKIE, projectId, {
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch {
    // sem request scope (ex. fora de uma Server Action) — nada a memorizar
  }
}
