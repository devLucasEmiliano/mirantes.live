import type { Project } from "@prisma/client";
import { matchProjectRef } from "./ref";

// Seleção do projeto PÚBLICO da home `/` (spec 016). Espelha `select.ts`: `pickPublicProject`
// e `publicSlug` são PUROS/unit-testáveis (sem runtime); `resolvePublicSelection` faz o I/O
// fino (lê cookie + lista públicos). Precedência: URL (`?projeto=`) > cookie > mais antigo.

/** Cookie que memoriza o último projeto público escolhido (link `?projeto=` tem prioridade). */
export const PUBLIC_PROJECT_COOKIE = "public_project_id";

export interface PublicProjectLike {
  id: string;
  name: string;
  owner: string;
  repo: string;
}

/** Slug compartilhável `owner/repo` (vai na URL `?projeto=` e identifica o público). */
export function publicSlug(p: PublicProjectLike): string {
  return `${p.owner}/${p.repo}`;
}

/**
 * Precedência: URL (match ÚNICO via `matchProjectRef`) > cookie (id ainda na lista) > mais
 * antigo (1º, já `createdAt asc`) > null. URL ambígua/inexistente cai p/ o cookie; cookie
 * inválido cai p/ o mais antigo. Puro — reusa o resolvedor de ref da spec 015.
 */
export function pickPublicProject<T extends PublicProjectLike>(
  projects: T[],
  urlRef: string | null,
  cookieId: string | null,
): T | null {
  if (projects.length === 0) return null;
  if (urlRef) {
    const match = matchProjectRef(projects, urlRef);
    if (match.ok) return match.project;
  }
  if (cookieId) {
    const chosen = projects.find((p) => p.id === cookieId);
    if (chosen) return chosen;
  }
  return projects[0] ?? null;
}

/**
 * Projeto público selecionado (Server Component): lê o cookie + lista os públicos + aplica
 * `pickPublicProject`. Imports DINÂMICOS p/ não arrastar `next/headers`/Prisma ao grafo do unit.
 */
export async function resolvePublicSelection(
  urlRef: string | null,
): Promise<Project | null> {
  const { cookies } = await import("next/headers");
  const { listPublicProjects } = await import("./public");
  const store = await cookies();
  const cookieId = store.get(PUBLIC_PROJECT_COOKIE)?.value ?? null;
  const projects = await listPublicProjects();
  return pickPublicProject(projects, urlRef, cookieId);
}
