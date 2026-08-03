import type { Project, Team } from "@prisma/client";
import { db } from "@/lib/db";

// Serviço de Equipes (spec 022): ÚNICO portão Postgres do domínio. Equipe = grupo de usuários
// com leitura compartilhada das metas de um projeto. Geridas só por admin (gate no route).
// 1 projeto → no máx. 1 equipe (Project.teamId): atribuir a uma 2ª equipe MOVE, nunca duplica.

export interface TeamWithDetails extends Team {
  members: {
    userId: string;
    email: string;
    name: string | null;
    role: string;
  }[];
  projects: { id: string; name: string; owner: string; repo: string }[];
}

export type TeamMutationResult =
  | { ok: true }
  | { ok: false; error: "not_found" };

export type AddMemberResult =
  | { ok: true }
  | {
      ok: false;
      error: "team_not_found" | "user_not_found" | "already_member";
    };

export type AssignProjectResult =
  | { ok: true }
  | { ok: false; error: "team_not_found" | "project_not_found" };

/** Todas as equipes com membros e projetos — admin-only (gate no route). */
export async function listTeams(): Promise<TeamWithDetails[]> {
  const teams = await db.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      projects: { orderBy: { createdAt: "asc" } },
    },
  });
  return teams.map((team) => ({
    ...team,
    members: team.members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.user.role,
    })),
    projects: team.projects.map((p) => ({
      id: p.id,
      name: p.name,
      owner: p.owner,
      repo: p.repo,
    })),
  }));
}

export async function createTeam(name: string): Promise<Team> {
  return db.team.create({ data: { name } });
}

export async function deleteTeam(id: string): Promise<TeamMutationResult> {
  // Sem soft delete p/ equipes (não é domínio auditável como metas): delete físico.
  // onDelete:Cascade cuida de team_members; onDelete:SetNull cuida de projects.teamId.
  const { count } = await db.team.deleteMany({ where: { id } });
  if (count === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function addMember(
  teamId: string,
  userId: string,
): Promise<AddMemberResult> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return { ok: false, error: "team_not_found" };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "user_not_found" };
  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (existing) return { ok: false, error: "already_member" };
  await db.teamMember.create({ data: { teamId, userId } });
  return { ok: true };
}

export async function removeMember(
  teamId: string,
  userId: string,
): Promise<TeamMutationResult> {
  const { count } = await db.teamMember.deleteMany({
    where: { teamId, userId },
  });
  if (count === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Atribui um projeto a uma equipe. É um simples `UPDATE project.teamId` — se o projeto já
 * pertencia a outra equipe, MOVE (nunca duplica leitura); cardinalidade 1 é garantida pela
 * própria natureza do UPDATE (não é um vínculo N:N).
 */
export async function assignProject(
  teamId: string,
  projectId: string,
): Promise<AssignProjectResult> {
  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) return { ok: false, error: "team_not_found" };
  const { count } = await db.project.updateMany({
    where: { id: projectId },
    data: { teamId },
  });
  if (count === 0) return { ok: false, error: "project_not_found" };
  return { ok: true };
}

/** Desatribui — só limpa se o projeto realmente pertence a ESTA equipe. */
export async function unassignProject(
  teamId: string,
  projectId: string,
): Promise<TeamMutationResult> {
  const { count } = await db.project.updateMany({
    where: { id: projectId, teamId },
    data: { teamId: null },
  });
  if (count === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

/** Todos os usuários do sistema — p/ o `<select>` de adicionar membro (admin). */
export async function listAssignableUsers(): Promise<
  { id: string; email: string; name: string | null; role: string }[]
> {
  const users = await db.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true, role: true },
  });
  return users;
}

/** Todos os projetos do sistema (escopo admin) — p/ o `<select>` de atribuição. */
export async function listAssignableProjects(): Promise<
  {
    id: string;
    name: string;
    owner: string;
    repo: string;
    teamId: string | null;
  }[]
> {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, owner: true, repo: true, teamId: true },
  });
  return projects;
}

/** IDs dos projetos de qualquer equipe de que o usuário participa (dedupe). */
export async function listTeamProjectIdsForUser(
  userId: string,
): Promise<string[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return [];
  const projects = await db.project.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
  });
  return [...new Set(projects.map((p) => p.id))];
}

/** Mesma coisa, linhas completas (ordenado por createdAt asc, espelha listProjects). */
export async function listTeamProjectsForUser(
  userId: string,
): Promise<Project[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (teamIds.length === 0) return [];
  return db.project.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { createdAt: "asc" },
  });
}
