import {
  type Branch,
  type Commit,
  Prisma,
  type Project,
  type WorkflowRun,
} from "@prisma/client";
import { db } from "@/lib/db";
import { isValidRepoSlug } from "./github/map";

// Serviço de Projetos: CRUD + leituras (estatística semanal e último commit) p/ a Visão
// Geral. Tudo ESCOPADO por papel (spec 009): admin enxerga tudo; client só os seus.
// Retornos discriminados (`ok`) p/ o Route Handler mapear a HTTP. Única porta ao Postgres
// no domínio de projetos.

/** Quem consulta: admin (global) ou um client (limitado aos seus projetos). */
export type Scope = { role: "admin" } | { role: "client"; userId: string };

/** Cláusula `where` por dono conforme o escopo (admin = sem filtro). */
function ownerWhere(scope: Scope): Prisma.ProjectWhereInput {
  return scope.role === "admin" ? {} : { userId: scope.userId };
}

/** Filtro por dono via relação `project` (p/ leituras sobre commits). */
function commitOwnerWhere(scope: Scope): Prisma.CommitWhereInput {
  return scope.role === "admin" ? {} : { project: { userId: scope.userId } };
}

/** Deriva o escopo do usuário logado (usado por rotas e páginas). */
export function scopeForUser(user: { id: string; role: string }): Scope {
  return user.role === "admin"
    ? { role: "admin" }
    : { role: "client", userId: user.id };
}

export interface CreateProjectInput {
  userId: string;
  name: string;
  owner: string;
  repo: string;
}

export type CreateProjectResult =
  | { ok: true; project: Project }
  | { ok: false; error: "invalid_slug" | "already_exists" };

/** Projeto com o log de atividade carregado (commits/branches/runs) p/ a tela. */
export interface ProjectWithActivity extends Project {
  commits: Commit[];
  branches: Branch[];
  workflowRuns: WorkflowRun[];
}

export type GetProjectResult =
  | { ok: true; project: ProjectWithActivity }
  | { ok: false; error: "not_found" };

export type DeleteProjectResult =
  | { ok: true }
  | { ok: false; error: "not_found" };

export interface LatestCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: Date;
  projectName: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cria 1 projeto = 1 repo, carimbando o dono (`userId`). Valida o slug ANTES de tocar o
 * banco. Colisão de `(userId, owner, repo)` (P2002) → already_exists — o mesmo repo pode
 * coexistir para usuários diferentes.
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  if (!isValidRepoSlug(input.owner, input.repo)) {
    return { ok: false, error: "invalid_slug" };
  }
  try {
    const project = await db.project.create({
      data: {
        userId: input.userId,
        name: input.name,
        owner: input.owner,
        repo: input.repo,
      },
    });
    return { ok: true, project };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, error: "already_exists" };
    }
    throw error;
  }
}

/** Lista projetos do escopo em ordem de criação (mais antigo primeiro). */
export async function listProjects(
  scope: Scope,
): Promise<{ projects: Project[] }> {
  const projects = await db.project.findMany({
    where: ownerWhere(scope),
    orderBy: { createdAt: "asc" },
  });
  return { projects };
}

/** Carrega 1 projeto do escopo + atividade. Alheio/inexistente → not_found. */
export async function getProject(
  id: string,
  scope: Scope,
): Promise<GetProjectResult> {
  const project = await db.project.findFirst({
    where: { id, ...ownerWhere(scope) },
    include: {
      commits: { orderBy: { committedAt: "desc" }, take: 10 },
      branches: { orderBy: { name: "asc" } },
      workflowRuns: { orderBy: { runStartedAt: "desc" }, take: 5 },
    },
  });
  if (!project) return { ok: false, error: "not_found" };
  return { ok: true, project };
}

/**
 * Remove 1 projeto do escopo (CASCADE leva commits/branches/runs). `deleteMany` com o
 * filtro de dono é atômico: 0 apagadas (alheio/inexistente) → not_found.
 */
export async function deleteProject(
  id: string,
  scope: Scope,
): Promise<DeleteProjectResult> {
  const { count } = await db.project.deleteMany({
    where: { id, ...ownerWhere(scope) },
  });
  if (count === 0) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Conta commits do escopo na janela atual (≤7d) e na anterior (7–14d), p/ o card
 * "Commits da Semana" e sua variação %.
 */
export async function weeklyCommitStats(
  scope: Scope,
  projectId?: string,
): Promise<{
  count: number;
  previousCount: number;
}> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS);
  // `projectId` (seletor do header) estreita o escopo a 1 projeto; sem ele = todo o escopo.
  const base = projectId
    ? { ...commitOwnerWhere(scope), projectId }
    : commitOwnerWhere(scope);
  const [count, previousCount] = await Promise.all([
    db.commit.count({
      where: { ...base, committedAt: { gte: sevenDaysAgo } },
    }),
    db.commit.count({
      where: {
        ...base,
        committedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
  ]);
  return { count, previousCount };
}

/** O commit mais recente do escopo (opcionalmente de 1 projeto), com o nome do projeto. */
export async function latestCommit(
  scope: Scope,
  projectId?: string,
): Promise<LatestCommit | null> {
  const commit = await db.commit.findFirst({
    where: projectId
      ? { ...commitOwnerWhere(scope), projectId }
      : commitOwnerWhere(scope),
    orderBy: { committedAt: "desc" },
    include: { project: { select: { name: true } } },
  });
  if (!commit) return null;
  return {
    sha: commit.sha,
    message: commit.message,
    author: commit.author,
    committedAt: commit.committedAt,
    projectName: commit.project.name,
  };
}
