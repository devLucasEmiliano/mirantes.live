// Handlers das tools de Metas do MCP (spec 013/015) — reusam o MESMO service do REST (único portão
// Postgres). Funções planas (scope, input) → resultado: o `server.ts` as embrulha em tools MCP
// com zod, e os testes de integração as exercitam direto. Erros do service viram `throw` (o MCP
// transforma em erro de tool).
//
// Spec 015: o projeto pode vir por referência humana (`project`: owner/repo|repo|name) ou ser o
// "projeto atual" (git remote do cwd); a meta pode vir por `shortCode` (M-1) além de `goalId`.
// `projectId`/`goalId` crus continuam aceitos (retrocompatível com a 013).
import type { Goal } from "@prisma/client";
import { db } from "@/lib/db";
import type { GoalStatus } from "@/lib/goals/derive";
import { type GoalDTO, toGoalDTO } from "@/lib/goals/dto";
import {
  archiveGoal,
  createGoal,
  findGoalIdByShortCode,
  goalOwnerWhere,
  linkBranch,
  linkCommit,
  listGoals,
  updateGoal,
} from "@/lib/goals/service";
import { listProjects, type Scope } from "@/lib/projects";
import { resolveProjectId } from "./project-context";

export interface MetasCreateInput {
  project?: string;
  projectId?: string;
  title: string;
  dueDate: string;
  description?: string;
  parentId?: string;
  status?: GoalStatus;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
}

/** Campos comuns p/ apontar uma meta: por id direto OU por short code no projeto resolvido. */
interface GoalRef {
  project?: string;
  projectId?: string;
  goalId?: string;
  shortCode?: string;
}

export interface MetasUpdateInput extends GoalRef {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  progress?: number;
  dueDate?: string;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
}

/**
 * `projectId` alvo p/ MUTAÇÕES: id cru se veio, senão resolve `project`/git (obrigatório). Lança
 * se não houver como resolver — criar/escopar exige um projeto concreto.
 */
async function requireProjectId(
  scope: Scope,
  ref: { project?: string; projectId?: string },
): Promise<string> {
  if (ref.projectId) return ref.projectId;
  const resolved = await resolveProjectId(scope, ref.project);
  if (!resolved) {
    throw new Error(
      "Não foi possível resolver o projeto. Passe `project` (owner/repo|repo|name) ou rode o MCP dentro do repositório.",
    );
  }
  return resolved;
}

/**
 * `goalId` alvo: id cru se veio; senão `shortCode` resolvido no projeto (project/git). Lança se
 * faltar referência ou a meta não existir no escopo.
 */
async function resolveGoalId(scope: Scope, ref: GoalRef): Promise<string> {
  if (ref.goalId) return ref.goalId;
  if (ref.shortCode) {
    const projectId = await requireProjectId(scope, ref);
    const id = await findGoalIdByShortCode(scope, projectId, ref.shortCode);
    if (!id) {
      throw new Error(
        `Meta "${ref.shortCode}" não encontrada no projeto resolvido.`,
      );
    }
    return id;
  }
  throw new Error("Informe `goalId` ou `shortCode`.");
}

export async function metasList(
  scope: Scope,
  input: { project?: string; projectId?: string },
): Promise<GoalDTO[]> {
  // `projectId` cru tem precedência; senão resolve `project`/git. Sem projeto resolvível
  // (sem ref e fora de um repo cadastrado) → lista todo o escopo.
  const projectId =
    input.projectId ??
    (await resolveProjectId(scope, input.project)) ??
    undefined;
  const goals = await listGoals(scope, projectId);
  return goals.map(toGoalDTO);
}

export async function metasCreate(
  scope: Scope,
  input: MetasCreateInput,
): Promise<Goal> {
  const projectId = await requireProjectId(scope, input);
  const { project: _project, projectId: _projectId, ...rest } = input;
  const result = await createGoal(scope, { ...rest, projectId });
  if (!result.ok) throw new Error(`metasCreate falhou: ${result.error}`);
  return result.goal;
}

export async function metasUpdate(
  scope: Scope,
  input: MetasUpdateInput,
): Promise<Goal> {
  const goalId = await resolveGoalId(scope, input);
  const {
    goalId: _goalId,
    project: _project,
    projectId: _projectId,
    shortCode: _shortCode,
    ...patch
  } = input;
  const result = await updateGoal(scope, goalId, patch);
  if (!result.ok) throw new Error(`metasUpdate falhou: ${result.error}`);
  return result.goal;
}

export async function metasArchive(
  scope: Scope,
  input: GoalRef,
): Promise<{ ok: true }> {
  const goalId = await resolveGoalId(scope, input);
  const result = await archiveGoal(scope, goalId);
  if (!result.ok) throw new Error(`metasArchive falhou: ${result.error}`);
  return { ok: true };
}

export async function metasLinkBranch(
  scope: Scope,
  input: GoalRef & { branchName: string },
): Promise<{ ok: true }> {
  const goalId = await resolveGoalId(scope, input);
  const result = await linkBranch(scope, goalId, input.branchName);
  if (!result.ok) throw new Error(`metasLinkBranch falhou: ${result.error}`);
  return { ok: true };
}

export async function metasLinkCommit(
  scope: Scope,
  input: GoalRef & { commitSha: string },
): Promise<{ ok: true }> {
  const goalId = await resolveGoalId(scope, input);
  // Resolve o sha → commitId DENTRO do projeto da meta (escopado), depois liga idempotente.
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
    select: { projectId: true },
  });
  if (!goal?.projectId) throw new Error("metasLinkCommit: meta não encontrada");
  const commit = await db.commit.findFirst({
    where: { projectId: goal.projectId, sha: input.commitSha },
    select: { id: true },
  });
  if (!commit) throw new Error("metasLinkCommit: commit não encontrado");
  const result = await linkCommit(scope, { goalId, commitId: commit.id });
  if (!result.ok) throw new Error(`metasLinkCommit falhou: ${result.error}`);
  return { ok: true };
}

/** Descoberta (spec 015): projetos do escopo p/ o agente escolher `project`/conferir o atual. */
export async function metasProjects(
  scope: Scope,
): Promise<{ id: string; name: string; owner: string; repo: string }[]> {
  const { projects } = await listProjects(scope);
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    owner: p.owner,
    repo: p.repo,
  }));
}
