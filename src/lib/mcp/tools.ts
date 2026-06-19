// Handlers das tools de Metas do MCP (spec 013) — reusam o MESMO service do REST (único portão
// Postgres). Funções planas (scope, input) → resultado: o `server.ts` as embrulha em tools MCP
// com zod, e os testes de integração as exercitam direto. Erros do service viram `throw` (o MCP
// transforma em erro de tool).
import type { Goal } from "@prisma/client";
import { db } from "@/lib/db";
import type { GoalStatus } from "@/lib/goals/derive";
import { type GoalDTO, toGoalDTO } from "@/lib/goals/dto";
import {
  archiveGoal,
  createGoal,
  goalOwnerWhere,
  linkBranch,
  linkCommit,
  listGoals,
  updateGoal,
} from "@/lib/goals/service";
import type { Scope } from "@/lib/projects";

export interface MetasCreateInput {
  projectId: string;
  title: string;
  dueDate: string;
  description?: string;
  parentId?: string;
  status?: GoalStatus;
  startValue?: number;
  targetValue?: number;
  currentValue?: number;
}

export interface MetasUpdateInput {
  goalId: string;
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  progress?: number;
  dueDate?: string;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
}

export async function metasList(
  scope: Scope,
  input: { projectId?: string },
): Promise<GoalDTO[]> {
  const goals = await listGoals(scope, input.projectId);
  return goals.map(toGoalDTO);
}

export async function metasCreate(
  scope: Scope,
  input: MetasCreateInput,
): Promise<Goal> {
  const result = await createGoal(scope, input);
  if (!result.ok) throw new Error(`metasCreate falhou: ${result.error}`);
  return result.goal;
}

export async function metasUpdate(
  scope: Scope,
  input: MetasUpdateInput,
): Promise<Goal> {
  const { goalId, ...patch } = input;
  const result = await updateGoal(scope, goalId, patch);
  if (!result.ok) throw new Error(`metasUpdate falhou: ${result.error}`);
  return result.goal;
}

export async function metasArchive(
  scope: Scope,
  input: { goalId: string },
): Promise<{ ok: true }> {
  const result = await archiveGoal(scope, input.goalId);
  if (!result.ok) throw new Error(`metasArchive falhou: ${result.error}`);
  return { ok: true };
}

export async function metasLinkBranch(
  scope: Scope,
  input: { goalId: string; branchName: string },
): Promise<{ ok: true }> {
  const result = await linkBranch(scope, input.goalId, input.branchName);
  if (!result.ok) throw new Error(`metasLinkBranch falhou: ${result.error}`);
  return { ok: true };
}

export async function metasLinkCommit(
  scope: Scope,
  input: { goalId: string; commitSha: string },
): Promise<{ ok: true }> {
  // Resolve o sha → commitId DENTRO do projeto da meta (escopado), depois liga idempotente.
  const goal = await db.goal.findFirst({
    where: { id: input.goalId, deletedAt: null, ...goalOwnerWhere(scope) },
    select: { projectId: true },
  });
  if (!goal?.projectId) throw new Error("metasLinkCommit: meta não encontrada");
  const commit = await db.commit.findFirst({
    where: { projectId: goal.projectId, sha: input.commitSha },
    select: { id: true },
  });
  if (!commit) throw new Error("metasLinkCommit: commit não encontrado");
  const result = await linkCommit(scope, {
    goalId: input.goalId,
    commitId: commit.id,
  });
  if (!result.ok) throw new Error(`metasLinkCommit falhou: ${result.error}`);
  return { ok: true };
}
