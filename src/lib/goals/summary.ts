// Resumo PURO da árvore de Metas (spec 014). Sem I/O — opera sobre a árvore já derivada por
// `deriveTree` (pais com status/percent agregados). Alimenta os cards da Visão Geral com os
// MESMOS números reais da página de Metas. Contagem ACHATA a árvore inteira (pais + folhas).
import type { DerivedGoal } from "./derive";

export interface GoalsSummary {
  /** Contagem de TODOS os nós (pais derivados + folhas) achatando a árvore. */
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  /** Nós com overdue=true (data passada e status ≠ done). */
  overdue: number;
  /** % agregado: média (arredondada) dos `percent` das metas de TOPO; 0 se vazio. */
  totalProgress: number;
  /** Menor `dueDate` (ISO AAAA-MM-DD) entre nós com status ≠ done; null se não houver. */
  nextDueDate: string | null;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Achata a árvore em pré-ordem (pai antes dos filhos). */
function flatten(nodes: DerivedGoal[]): DerivedGoal[] {
  const out: DerivedGoal[] = [];
  for (const node of nodes) {
    out.push(node);
    out.push(...flatten(node.children));
  }
  return out;
}

export function summarizeGoals(tree: DerivedGoal[]): GoalsSummary {
  const all = flatten(tree);

  let done = 0;
  let inProgress = 0;
  let todo = 0;
  let overdue = 0;
  let earliestOpen: Date | null = null;

  for (const node of all) {
    if (node.status === "done") done += 1;
    else if (node.status === "in_progress") inProgress += 1;
    else todo += 1;

    if (node.overdue) overdue += 1;

    if (node.status !== "done") {
      if (
        earliestOpen === null ||
        node.dueDate.getTime() < earliestOpen.getTime()
      ) {
        earliestOpen = node.dueDate;
      }
    }
  }

  const totalProgress =
    tree.length === 0
      ? 0
      : Math.round(tree.reduce((sum, g) => sum + g.percent, 0) / tree.length);

  return {
    total: all.length,
    done,
    inProgress,
    todo,
    overdue,
    totalProgress,
    nextDueDate: earliestOpen === null ? null : toDateOnly(earliestOpen),
  };
}
