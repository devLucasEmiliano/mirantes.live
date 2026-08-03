import type { Project } from "@prisma/client";

// Seleção do projeto de EQUIPE na tela de Metas (spec 022). Espelha `projects/select.ts`, mas
// com cookie/portão PRÓPRIOS — a seção "Metas de equipe" é independente do seletor do header
// (que segue só-dono). `pickTeamProject` é puro/unit-testável (sem imports de runtime).
// `resolveTeamProjectSelection` lê o cookie no servidor (imports DINÂMICOS, mesmo padrão de
// `resolveSelectedProject`). A Server Action `selectMetasTeamProject` mora em `./team-actions`
// (arquivo "use server" DEDICADO — divergência do plano original: colocá-la aqui mesmo fazia o
// bundler do client puxar o módulo inteiro, incluindo `@/lib/teams`/`@/lib/db`/`pg`, para o
// browser — "Module not found: net/tls" — mesmo padrão de `projects/select.ts` + `actions.ts`).

/** Nome do cookie que persiste a escolha do projeto na seção "Metas de equipe". */
export const METAS_TEAM_PROJECT_COOKIE = "metas_team_project_id";

/** Escolhe o projeto do cookie; fallback = mais antigo (1º da lista). Lista vazia → null. */
export function pickTeamProject<T extends { id: string }>(
  projects: T[],
  cookieVal?: string,
): T | null {
  if (projects.length === 0) return null;
  if (cookieVal) {
    const chosen = projects.find((p) => p.id === cookieVal);
    if (chosen) return chosen;
  }
  return projects[0] ?? null;
}

/**
 * Projeto de equipe selecionado do usuário (Server Component): lê o cookie + lista os
 * projetos de equipe do usuário + aplica `pickTeamProject`. Fallback = mais antigo.
 */
export async function resolveTeamProjectSelection(
  userId: string,
): Promise<Project | null> {
  const { cookies } = await import("next/headers");
  const { listTeamProjectsForUser } = await import("@/lib/teams");
  const store = await cookies();
  const cookieVal = store.get(METAS_TEAM_PROJECT_COOKIE)?.value;
  const projects = await listTeamProjectsForUser(userId);
  return pickTeamProject(projects, cookieVal);
}
