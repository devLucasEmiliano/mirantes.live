// Filtros PUROS dos pickers de Equipes (spec 023). Mora fora de `teams.ts` de propósito:
// aquele arquivo importa `@/lib/db` → `pg`, e um Client Component que importasse de lá
// arrastaria o Prisma para o bundle do browser (`Module not found: net/tls`). Aqui não entra
// `@/lib/db`, React nem `"use server"` — só funções puras, testáveis em unit sem jsdom.
// Pelo mesmo motivo não existe `src/lib/teams/`: `@/lib/teams` ficaria ambíguo.

export interface FilterableUser {
  id: string;
  email: string;
  name: string | null;
}

export interface FilterableProject {
  id: string;
  name: string;
  owner: string;
  repo: string;
  teamId: string | null;
}

export interface FilterableTeam {
  id: string;
  name: string;
}

// Marcas combinantes que a decomposição NFD separa da letra base (U+0300–U+036F).
const COMBINING_MARKS = /[̀-ͯ]/g;

/** lower-case + remove acentos (NFD) — "João" e "joao" casam. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** Tira quem já é membro; filtra por nome OU email. Query vazia devolve todos os disponíveis. */
export function filterUsers(
  users: FilterableUser[],
  memberIds: string[],
  query: string,
): FilterableUser[] {
  const available = users.filter((user) => !memberIds.includes(user.id));
  const term = normalize(query.trim());
  if (term === "") return available;
  return available.filter(
    (user) =>
      normalize(user.name ?? "").includes(term) ||
      normalize(user.email).includes(term),
  );
}

/** Tira os projetos JÁ desta equipe; filtra por `owner/repo`. Projeto de OUTRA equipe fica. */
export function filterProjects(
  projects: FilterableProject[],
  teamId: string,
  query: string,
): FilterableProject[] {
  const available = projects.filter((project) => project.teamId !== teamId);
  const term = normalize(query.trim());
  if (term === "") return available;
  return available.filter((project) =>
    normalize(`${project.owner}/${project.repo}`).includes(term),
  );
}

/** Label do badge "em {equipe}" — null quando sem equipe ou teamId órfão. */
export function teamNameOf(
  teamId: string | null,
  teams: FilterableTeam[],
): string | null {
  if (!teamId) return null;
  return teams.find((team) => team.id === teamId)?.name ?? null;
}
