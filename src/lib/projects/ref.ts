// Resolução PURA de "qual projeto" a partir de uma referência humana (spec 015): aceita
// `owner/repo`, `repo` sozinho ou `name`, case-insensitive e com trim. Espelha o padrão
// puro/unit-testável de `pickSelectedProject` (`select.ts`): sem I/O, genérico sobre o
// formato mínimo do projeto. A função I/O que carrega os projetos do escopo vive em
// `../projects.ts` (`findProjectByRef`).

export interface ProjectRefLike {
  name: string;
  owner: string;
  repo: string;
}

export type MatchProjectResult<P extends ProjectRefLike> =
  | { ok: true; project: P }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "ambiguous"; matches: P[] };

/**
 * Casa uma referência humana a um projeto por PRECEDÊNCIA (case-insensitive, com trim):
 * `owner/repo` exato → `repo` exato → `name` exato. No PRIMEIRO nível com algum match: 1 →
 * `ok`; >1 → `ambiguous` (devolve os candidatos daquele nível). Nenhum match em nível algum →
 * `not_found`. A precedência garante que um `owner/repo` literal nunca seja ofuscado por um
 * `name` que por acaso seja igual.
 */
export function matchProjectRef<P extends ProjectRefLike>(
  projects: P[],
  ref: string,
): MatchProjectResult<P> {
  const norm = ref.trim().toLowerCase();
  if (norm === "") return { ok: false, error: "not_found" };

  const levels: ((p: P) => string)[] = [
    (p) => `${p.owner}/${p.repo}`,
    (p) => p.repo,
    (p) => p.name,
  ];

  for (const key of levels) {
    const matches = projects.filter((p) => key(p).toLowerCase() === norm);
    if (matches.length === 1) return { ok: true, project: matches[0] };
    if (matches.length > 1) return { ok: false, error: "ambiguous", matches };
  }
  return { ok: false, error: "not_found" };
}
