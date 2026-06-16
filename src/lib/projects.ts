import {
  type Branch,
  type Commit,
  Prisma,
  type Project,
  type WorkflowRun,
} from "@prisma/client";
import { db } from "@/lib/db";
import { isValidRepoSlug } from "./github/map";

// Serviço de Projetos: CRUD + consumidores de leitura (estatística semanal de commits
// e último commit) para a Visão Geral. Retornos discriminados (`ok`) p/ o Route Handler
// mapear a HTTP. Única porta de acesso ao Postgres no domínio de projetos.

export interface CreateProjectInput {
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
 * Cria 1 projeto = 1 repo. Valida o slug owner/repo ANTES de tocar o banco (nada é
 * gravado em slug inválido). Colisão de `(owner, repo)` (Prisma P2002) → already_exists.
 */
export async function createProject(
  input: CreateProjectInput,
): Promise<CreateProjectResult> {
  if (!isValidRepoSlug(input.owner, input.repo)) {
    return { ok: false, error: "invalid_slug" };
  }
  try {
    const project = await db.project.create({
      data: { name: input.name, owner: input.owner, repo: input.repo },
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

/** Lista projetos em ordem de criação (mais antigo primeiro). */
export async function listProjects(): Promise<{ projects: Project[] }> {
  const projects = await db.project.findMany({ orderBy: { createdAt: "asc" } });
  return { projects };
}

/** Carrega 1 projeto com seu log de atividade recente (commits/branches/runs). */
export async function getProject(id: string): Promise<GetProjectResult> {
  const project = await db.project.findUnique({
    where: { id },
    include: {
      commits: { orderBy: { committedAt: "desc" }, take: 10 },
      branches: { orderBy: { name: "asc" } },
      workflowRuns: { orderBy: { runStartedAt: "desc" }, take: 5 },
    },
  });
  if (!project) return { ok: false, error: "not_found" };
  return { ok: true, project };
}

/** Remove 1 projeto; CASCADE leva commits/branches/runs juntos. P2025 → not_found. */
export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  try {
    await db.project.delete({ where: { id } });
    return { ok: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { ok: false, error: "not_found" };
    }
    throw error;
  }
}

/**
 * Conta commits (todos os projetos — PRD §5) na janela atual (≤7d) e na anterior
 * (7–14d), p/ o card "Commits da Semana" e sua variação %.
 */
export async function weeklyCommitStats(): Promise<{
  count: number;
  previousCount: number;
}> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now - 14 * DAY_MS);
  const [count, previousCount] = await Promise.all([
    db.commit.count({ where: { committedAt: { gte: sevenDaysAgo } } }),
    db.commit.count({
      where: { committedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
  ]);
  return { count, previousCount };
}

/** O commit mais recente entre todos os projetos, com o nome do projeto. Null se vazio. */
export async function latestCommit(): Promise<LatestCommit | null> {
  const commit = await db.commit.findFirst({
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
