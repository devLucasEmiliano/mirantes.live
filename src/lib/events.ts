import type { Event as EventRow, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Scope } from "@/lib/projects";
import type { TimelineEvent } from "@/lib/types";

// Leitura da Timeline unificada (spec 012). Escopada por papel (cliente só visível + próprio/
// global; admin tudo), paginada por cursor (`id desc`). `listShowcaseEvents` é o feed PÚBLICO
// da home (sem Scope): vitrine = projeto mais antigo de um admin, só `visibleToClient:true`.

export interface ListEventsOptions {
  /** Filtra por projeto (seletor do header). */
  projectId?: string;
  /** `events.id` (string) da página anterior → devolve `id < cursor`. */
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 30;

/** Serializa a linha do banco no DTO JSON-safe (= `TimelineEvent`): `id` String, `createdAt` ISO. */
function toDTO(row: EventRow): TimelineEvent {
  return {
    id: String(row.id),
    source: row.source as TimelineEvent["source"],
    type: row.type,
    title: row.title,
    detail: row.detail ?? undefined,
    createdAt: row.createdAt.toISOString(),
    visibleToClient: row.visibleToClient,
  };
}

/** `where` por escopo: cliente vê só visível E (projeto próprio OU global); admin vê tudo. */
function scopeWhere(scope: Scope): Prisma.EventWhereInput {
  if (scope.role === "admin") return {};
  return {
    visibleToClient: true,
    OR: [{ project: { userId: scope.userId } }, { projectId: null }],
  };
}

export async function listEvents(
  scope: Scope,
  options: ListEventsOptions = {},
): Promise<{ events: TimelineEvent[]; nextCursor: string | null }> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const where: Prisma.EventWhereInput = { ...scopeWhere(scope) };
  if (options.projectId) where.projectId = options.projectId;
  if (options.cursor) where.id = { lt: BigInt(options.cursor) };

  // Busca limit+1 p/ saber se há próxima página sem um count separado.
  const rows = await db.event.findMany({
    where,
    orderBy: { id: "desc" },
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? String(last.id) : null;
  return { events: page.map(toDTO), nextCursor };
}

/**
 * Feed da vitrine PÚBLICA (sem `Scope`): default = projeto PÚBLICO mais antigo (spec 016 — antes
 * era "mais antigo de um admin"). Delega a `listPublicEvents` (só `visibleToClient:true`). Sem
 * projeto público → `[]`. A home `/` compõe o feed do projeto SELECIONADO; este helper serve o
 * default da vitrine.
 */
export async function listShowcaseEvents(limit = 7): Promise<TimelineEvent[]> {
  const project = await db.project.findFirst({
    where: { isPublic: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!project) return [];
  return listPublicEvents(project.id, limit);
}

/**
 * Eventos do projeto PÚBLICO (spec 016) — scope-free: só `visibleToClient:true`, `id desc`.
 * A home `/` e `listShowcaseEvents` delegam aqui depois de resolver o projeto público (cuja
 * visibilidade já foi validada por `getPublicProject`/`resolvePublicSelection`).
 */
export async function listPublicEvents(
  projectId: string,
  limit = 7,
): Promise<TimelineEvent[]> {
  const rows = await db.event.findMany({
    where: { projectId, visibleToClient: true },
    orderBy: { id: "desc" },
    take: limit,
  });
  return rows.map(toDTO);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Contagens da semana (7d) p/ o painel "RESUMO DA SEMANA" da Timeline. Escopadas + por projeto. */
export async function weeklyEventStats(
  scope: Scope,
  projectId?: string,
): Promise<{ commits: number; ci: number; total: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const base: Prisma.EventWhereInput = {
    ...scopeWhere(scope),
    createdAt: { gte: sevenDaysAgo },
  };
  if (projectId) base.projectId = projectId;
  const [commits, ci, total] = await Promise.all([
    // Merge é commit: conta `commit.created` + `commit.merged` no total de commits da semana.
    db.event.count({
      where: { ...base, type: { in: ["commit.created", "commit.merged"] } },
    }),
    db.event.count({ where: { ...base, type: "ci.run" } }),
    db.event.count({ where: base }),
  ]);
  return { commits, ci, total };
}
