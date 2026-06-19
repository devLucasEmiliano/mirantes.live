// Derivação PURA de Metas (spec 013 §"derive.ts"). Sem Prisma, sem I/O — só regras de
// cálculo testáveis isoladamente (CLAUDE.md §5.1). Duas formas de progresso coexistem na
// folha: X→Y medível (start/target/current) OU manual 0–100. Pai sempre DERIVA (média dos
// filhos / status agregado) — read-only na leitura.

export type GoalStatus = "todo" | "in_progress" | "done";

export interface GoalRow {
  id: string;
  parentId: string | null;
  shortCode: string;
  title: string;
  status: GoalStatus;
  progress: number;
  dueDate: Date;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  position: number;
  // Não participam da derivação — só viajam para o DTO/UI (opcionais p/ não exigir nos testes puros).
  projectId?: string | null;
  description?: string | null;
}

export interface DerivedGoal extends Omit<GoalRow, "children"> {
  percent: number;
  overdue: boolean;
  derived: boolean;
  children: DerivedGoal[];
}

/**
 * Completude 0–100 de uma folha medível, por |Δ| (suporta ascendente 0→20 e descendente
 * 20→0). `span` 0 (start===target) evita /0: 100 se já atingiu o alvo, senão 0. Clampa 0..100.
 */
export function computePercent(
  start: number,
  target: number,
  current: number,
): number {
  const span = Math.abs(target - start);
  if (span === 0) return current === target ? 100 : 0;
  const moved = Math.abs(current - start);
  return Math.max(0, Math.min(100, Math.round((moved / span) * 100)));
}

/**
 * Move `current` por `weight` na direção do alvo (sign(target-start)) e clampa NO alvo
 * (não passa de target). start===target → nada a mover.
 */
export function applyWeight(
  start: number,
  target: number,
  current: number,
  weight: number,
): number {
  const dir = Math.sign(target - start);
  if (dir === 0) return current;
  const next = current + dir * weight;
  return dir > 0 ? Math.min(next, target) : Math.max(next, target);
}

/** Folha COM alvo → computePercent; folha SEM alvo → progress manual. */
export function deriveLeafProgress(leaf: GoalRow): number {
  if (leaf.targetValue !== null) {
    return computePercent(
      leaf.startValue ?? 0,
      leaf.targetValue,
      leaf.currentValue ?? leaf.startValue ?? 0,
    );
  }
  return leaf.progress;
}

/** Folha COM alvo → done quando percent≥100, senão o status armazenado; SEM alvo → status. */
export function deriveLeafStatus(leaf: GoalRow): GoalStatus {
  if (leaf.targetValue !== null) {
    return deriveLeafProgress(leaf) >= 100 ? "done" : leaf.status;
  }
  return leaf.status;
}

/** Média simples arredondada dos progressos dos filhos (0 se vazio). */
export function deriveProgress(childProgress: number[]): number {
  if (childProgress.length === 0) return 0;
  const sum = childProgress.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / childProgress.length);
}

/** Todos done → done; todos todo → todo; qualquer mistura → in_progress. */
export function deriveStatus(childStatuses: GoalStatus[]): GoalStatus {
  if (childStatuses.length === 0) return "todo";
  if (childStatuses.every((s) => s === "done")) return "done";
  if (childStatuses.every((s) => s === "todo")) return "todo";
  return "in_progress";
}

/** Atrasada = data prevista no passado E status ≠ done (PRD §4.5). */
export function isOverdue(
  dueDate: Date,
  status: GoalStatus,
  now: Date,
): boolean {
  return dueDate.getTime() < now.getTime() && status !== "done";
}

/**
 * Monta a árvore (por parentId) e deriva bottom-up: folha calcula percent/status de si; pai
 * deriva da média/agregação dos filhos (derived=true). Ordena irmãos por `position`.
 */
export function deriveTree(rows: GoalRow[], now: Date): DerivedGoal[] {
  const childrenOf = new Map<string | null, GoalRow[]>();
  for (const row of rows) {
    const siblings = childrenOf.get(row.parentId) ?? [];
    siblings.push(row);
    childrenOf.set(row.parentId, siblings);
  }

  const build = (row: GoalRow): DerivedGoal => {
    const kids = (childrenOf.get(row.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(build);

    if (kids.length > 0) {
      const progress = deriveProgress(kids.map((k) => k.percent));
      const status = deriveStatus(kids.map((k) => k.status));
      return {
        ...row,
        progress,
        percent: progress,
        status,
        overdue: isOverdue(row.dueDate, status, now),
        derived: true,
        children: kids,
      };
    }

    const percent = deriveLeafProgress(row);
    const status = deriveLeafStatus(row);
    return {
      ...row,
      progress: percent,
      percent,
      status,
      overdue: isOverdue(row.dueDate, status, now),
      derived: false,
      children: [],
    };
  };

  return (childrenOf.get(null) ?? [])
    .sort((a, b) => a.position - b.position)
    .map(build);
}
