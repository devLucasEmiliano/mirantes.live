// Service de Metas (spec 013) — ÚNICO portão Postgres do domínio. Reusa o padrão de
// `projects.ts`: `Scope` + `*OwnerWhere` para escopo por papel e retornos discriminados
// `{ ok } | { ok: false; error }`. Regras de derivação (X→Y, pai) ficam no `derive.ts` puro;
// aqui mora só o I/O (CRUD escopado, short code transacional, soft delete em cascata, links).
import type { Goal, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { Scope } from "@/lib/projects";
import {
  applyWeight,
  type DerivedGoal,
  deriveTree,
  type GoalRow,
  type GoalStatus,
} from "./derive";
import { type GoalEventKind, goalToEvent } from "./emit";

export interface CreateGoalInput {
  projectId: string | null;
  title: string;
  dueDate: Date | string;
  parentId?: string | null;
  description?: string | null;
  status?: GoalStatus;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  progress?: number;
  dueDate?: Date | string;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
}

export type CreateGoalResult =
  | { ok: true; goal: Goal }
  | { ok: false; error: "not_found" | "invalid_parent" };

export type UpdateGoalResult =
  | { ok: true; goal: Goal }
  | { ok: false; error: "not_found" | "has_children" };

export type ArchiveGoalResult =
  | { ok: true }
  | { ok: false; error: "not_found" };

export type LinkResult = { ok: true } | { ok: false; error: "not_found" };

/** Escopo de leitura/mutação: admin tudo; cliente só metas de projeto próprio (globais excluídas). */
export function goalOwnerWhere(scope: Scope): Prisma.GoalWhereInput {
  return scope.role === "admin" ? {} : { project: { userId: scope.userId } };
}

function projectScopeWhere(scope: Scope): Prisma.ProjectWhereInput {
  return scope.role === "admin" ? {} : { userId: scope.userId };
}

function toGoalRow(g: Goal): GoalRow {
  return {
    id: g.id,
    parentId: g.parentId,
    shortCode: g.shortCode,
    title: g.title,
    status: g.status as GoalStatus,
    progress: g.progress,
    dueDate: g.dueDate,
    startValue: g.startValue,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    position: g.position,
    projectId: g.projectId,
    description: g.description,
  };
}

async function emitGoalEvent(goal: Goal, kind: GoalEventKind): Promise<void> {
  const ev = goalToEvent(goal, kind, new Date());
  await db.event.create({
    data: {
      source: ev.source,
      type: ev.type,
      refId: ev.refId,
      projectId: ev.projectId,
      title: ev.title,
      detail: ev.detail,
      visibleToClient: ev.visibleToClient,
      createdAt: ev.createdAt,
    },
  });
}

/**
 * Short code sequencial por projeto (M-1, M-2…) via UPSERT atômico no contador. Para meta
 * global (sem projeto, fora da UI) gera um código G-N sem contador dedicado.
 */
async function nextShortCode(
  tx: Prisma.TransactionClient,
  projectId: string | null,
): Promise<string> {
  if (projectId === null) {
    const n = await tx.goal.count({ where: { projectId: null } });
    return `G-${n + 1}`;
  }
  const rows = await tx.$queryRaw<{ next: number }[]>`
    INSERT INTO goal_code_counters (project_id, next) VALUES (${projectId}::uuid, 2)
    ON CONFLICT (project_id) DO UPDATE SET next = goal_code_counters.next + 1
    RETURNING next
  `;
  return `M-${rows[0].next - 1}`;
}

/**
 * Resolve `(projectId, shortCode)` → `goalId` dentro do escopo (spec 015). Mesmo portão
 * Postgres das metas; usado pelo MCP p/ referenciar metas por `M-1` no projeto atual.
 */
export async function findGoalIdByShortCode(
  scope: Scope,
  projectId: string,
  shortCode: string,
): Promise<string | null> {
  const goal = await db.goal.findFirst({
    where: { projectId, shortCode, deletedAt: null, ...goalOwnerWhere(scope) },
    select: { id: true },
  });
  return goal?.id ?? null;
}

/** Árvore derivada (top-level) do escopo, opcionalmente filtrada por projeto. */
export async function listGoals(
  scope: Scope,
  projectId?: string | null,
): Promise<DerivedGoal[]> {
  const where: Prisma.GoalWhereInput = {
    deletedAt: null,
    ...goalOwnerWhere(scope),
    ...(projectId != null ? { projectId } : {}),
  };
  const rows = await db.goal.findMany({ where, orderBy: { position: "asc" } });
  return deriveTree(rows.map(toGoalRow), new Date());
}

/**
 * Metas do projeto PÚBLICO (spec 016) — scope-free: serve só se o projeto for `isPublic`
 * (`project: { isPublic: true }` no `where`, no lugar do `goalOwnerWhere`). A visibilidade
 * pública É a autorização: passar o id de um projeto privado devolve `[]`. Mesma derivação de
 * `listGoals`.
 */
export async function listPublicGoals(
  projectId: string,
): Promise<DerivedGoal[]> {
  const rows = await db.goal.findMany({
    where: { projectId, deletedAt: null, project: { isPublic: true } },
    orderBy: { position: "asc" },
  });
  return deriveTree(rows.map(toGoalRow), new Date());
}

export async function createGoal(
  scope: Scope,
  input: CreateGoalInput,
): Promise<CreateGoalResult> {
  // Projeto-alvo precisa estar no escopo (cliente só no próprio). Global só admin.
  if (input.projectId != null) {
    const project = await db.project.findFirst({
      where: { id: input.projectId, ...projectScopeWhere(scope) },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "not_found" };
  } else if (scope.role !== "admin") {
    return { ok: false, error: "not_found" };
  }

  // Pai (se houver) tem de existir no escopo e no mesmo projeto.
  if (input.parentId) {
    const parent = await db.goal.findFirst({
      where: { id: input.parentId, deletedAt: null, ...goalOwnerWhere(scope) },
      select: { id: true, projectId: true },
    });
    if (!parent || parent.projectId !== input.projectId) {
      return { ok: false, error: "invalid_parent" };
    }
  }

  const dueDate =
    typeof input.dueDate === "string" ? new Date(input.dueDate) : input.dueDate;
  const measurable = input.targetValue != null;
  const goal = await db.$transaction(async (tx) => {
    const shortCode = await nextShortCode(tx, input.projectId);
    const max = await tx.goal.aggregate({
      where: { projectId: input.projectId, parentId: input.parentId ?? null },
      _max: { position: true },
    });
    return tx.goal.create({
      data: {
        projectId: input.projectId,
        parentId: input.parentId ?? null,
        shortCode,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "todo",
        progress: 0,
        dueDate,
        startValue: input.startValue ?? null,
        targetValue: input.targetValue ?? null,
        currentValue: measurable
          ? (input.currentValue ?? input.startValue ?? 0)
          : (input.currentValue ?? null),
        position: (max._max.position ?? 0) + 1,
      },
    });
  });

  await emitGoalEvent(goal, "created");
  return { ok: true, goal };
}

export async function updateGoal(
  scope: Scope,
  goalId: string,
  input: UpdateGoalInput,
): Promise<UpdateGoalResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
  });
  if (!goal) return { ok: false, error: "not_found" };

  // Progresso/status de PAI é derivado (read-only): rejeita edição manual se tem filhos.
  if (input.progress !== undefined || input.status !== undefined) {
    const childCount = await db.goal.count({
      where: { parentId: goalId, deletedAt: null },
    });
    if (childCount > 0) return { ok: false, error: "has_children" };
  }

  const data: Prisma.GoalUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.progress !== undefined) data.progress = input.progress;
  if (input.startValue !== undefined) data.startValue = input.startValue;
  if (input.targetValue !== undefined) data.targetValue = input.targetValue;
  if (input.currentValue !== undefined) data.currentValue = input.currentValue;
  if (input.dueDate !== undefined) {
    data.dueDate =
      typeof input.dueDate === "string"
        ? new Date(input.dueDate)
        : input.dueDate;
  }
  if (input.status !== undefined) {
    data.status = input.status;
    data.completedAt = input.status === "done" ? new Date() : null;
  }

  const updated = await db.goal.update({ where: { id: goalId }, data });
  await emitGoalEvent(
    updated,
    input.status === "done" ? "completed" : "updated",
  );
  return { ok: true, goal: updated };
}

async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await db.goal.findMany({
      where: { parentId: { in: frontier }, deletedAt: null },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    ids.push(...childIds);
    frontier = childIds;
  }
  return ids;
}

export async function archiveGoal(
  scope: Scope,
  goalId: string,
): Promise<ArchiveGoalResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
  });
  if (!goal) return { ok: false, error: "not_found" };

  // Soft delete em cascata: onDelete:Cascade do Prisma é p/ delete físico; aqui marcamos
  // deleted_at na subárvore inteira manualmente.
  const ids = await collectSubtreeIds(goalId);
  await db.goal.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await emitGoalEvent(goal, "archived");
  return { ok: true };
}

export async function linkBranch(
  scope: Scope,
  goalId: string,
  branchName: string,
): Promise<LinkResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
    select: { id: true, projectId: true },
  });
  if (!goal || goal.projectId === null)
    return { ok: false, error: "not_found" };
  await db.goalBranchLink.upsert({
    where: {
      projectId_branchName: { projectId: goal.projectId, branchName },
    },
    create: { goalId: goal.id, projectId: goal.projectId, branchName },
    update: { goalId: goal.id },
  });
  return { ok: true };
}

export async function unlinkBranch(
  scope: Scope,
  goalId: string,
  branchName: string,
): Promise<LinkResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
    select: { id: true, projectId: true },
  });
  if (!goal || goal.projectId === null)
    return { ok: false, error: "not_found" };
  await db.goalBranchLink.deleteMany({
    where: { projectId: goal.projectId, branchName, goalId: goal.id },
  });
  return { ok: true };
}

/**
 * Liga um commit a uma meta de forma IDEMPOTENTE (unique commit_id+goal_id) e aplica o peso
 * uma única vez. Caminho MANUAL (usado pelo MCP); a atribuição automática do sync mora em
 * `attribution.ts` com sua própria aplicação idempotente.
 */
export async function linkCommit(
  scope: Scope,
  { goalId, commitId }: { goalId: string; commitId: string },
): Promise<LinkResult> {
  const goal = await db.goal.findFirst({
    where: { id: goalId, deletedAt: null, ...goalOwnerWhere(scope) },
  });
  if (!goal) return { ok: false, error: "not_found" };
  const commit = await db.commit.findUnique({
    where: { id: commitId },
    select: { id: true, isMerge: true },
  });
  if (!commit) return { ok: false, error: "not_found" };

  const weight = commit.isMerge
    ? env.GOAL_WEIGHT_MERGE
    : env.GOAL_WEIGHT_COMMIT;
  const { count } = await db.commitGoalLink.createMany({
    data: [{ commitId, goalId, weight, method: "manual" }],
    skipDuplicates: true,
  });
  if (count === 0) return { ok: true }; // já ligado — não reaplica (idempotente)

  if (goal.targetValue !== null) {
    const next = applyWeight(
      goal.startValue ?? 0,
      goal.targetValue,
      goal.currentValue ?? goal.startValue ?? 0,
      weight,
    );
    const done = next === goal.targetValue;
    await db.goal.update({
      where: { id: goalId },
      data: {
        currentValue: next,
        status: done ? "done" : "in_progress",
        completedAt: done ? new Date() : null,
      },
    });
    await db.commitGoalLink.update({
      where: { commitId_goalId: { commitId, goalId } },
      data: { appliedValue: next },
    });
    await emitGoalEvent(
      { ...goal, currentValue: next },
      done ? "completed" : "updated",
    );
  }
  return { ok: true };
}
