import { ChevronDown, Search } from "lucide-react";
import { GoalRow } from "@/components/metas/goal-row";
import type { Goal } from "@/lib/types";

interface GoalsListProps {
  goals: Goal[];
  title?: string;
}

/**
 * Seção "Metas do Projeto" da Visão Geral/Home: grupos estáticos
 * (pai em destaque + filhos indentados). A versão interativa com
 * expandir/recolher vive em components/metas/goal-tree.tsx.
 */
export function GoalsList({
  goals,
  title = "Metas do Projeto",
}: GoalsListProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          {title}
        </h2>
        <span className="flex items-center gap-2 rounded-sm bg-surface-elevated px-3 py-[7px]">
          <Search className="size-3.5 text-foreground-muted" />
          <span className="text-[13px] text-foreground-muted">
            Filtrar metas...
          </span>
        </span>
      </div>

      {goals.map((group) => (
        <div
          key={group.id}
          className="flex flex-col rounded-sm bg-surface-card py-1"
        >
          <GoalRow
            goal={group}
            compact
            chevron={<ChevronDown className="size-3.5 text-foreground-muted" />}
          />
          {group.children?.map((child) => (
            <GoalRow key={child.id} goal={child} subdued compact />
          ))}
        </div>
      ))}
    </section>
  );
}
