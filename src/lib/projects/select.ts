import type { Project } from "@prisma/client";
import type { Scope } from "@/lib/projects";

// Seleção de projeto do header. `pickSelectedProject` é puro/unit-testável (sem imports de
// runtime). `resolveSelectedProject` lê o cookie no servidor (imports DINÂMICOS p/ não arrastar
// next/headers nem o Prisma para o grafo do teste unit). A Server Action `selectProject` mora
// em `./actions` (arquivo "use server" dedicado), chamada pelo switcher (client).

/** Nome do cookie que persiste a escolha do projeto no header. */
export const SELECTED_PROJECT_COOKIE = "selected_project_id";

/** Escolhe o projeto do cookie; fallback = mais antigo (1º da lista, que vem `createdAt asc`). */
export function pickSelectedProject<T extends { id: string }>(
  projects: T[],
  cookieVal: string | null,
): T | null {
  if (projects.length === 0) return null;
  if (cookieVal) {
    const chosen = projects.find((p) => p.id === cookieVal);
    if (chosen) return chosen;
  }
  return projects[0] ?? null;
}

/**
 * Projeto selecionado do escopo (Server Component): lê o cookie + lista os projetos + aplica
 * `pickSelectedProject`. Fallback = mais antigo. Usado pelas páginas p/ filtrar dashboard/timeline.
 */
export async function resolveSelectedProject(
  scope: Scope,
): Promise<Project | null> {
  const { cookies } = await import("next/headers");
  const { listProjects } = await import("@/lib/projects");
  const store = await cookies();
  const cookieVal = store.get(SELECTED_PROJECT_COOKIE)?.value ?? null;
  const { projects } = await listProjects(scope);
  return pickSelectedProject(projects, cookieVal);
}
