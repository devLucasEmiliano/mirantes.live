"use client";

import {
  Archive,
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GoalDetailPanel } from "@/components/metas/goal-detail-panel";
import { GoalRow } from "@/components/metas/goal-row";
import type { Goal } from "@/lib/types";

interface MetasViewProps {
  goals: Goal[];
}

/**
 * Conteúdo interativo da página de Metas: busca, grupos expansíveis e
 * seleção de meta → painel de detalhe. Estado apenas local (mock).
 */
export function MetasView({ goals }: MetasViewProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>("g1-2");

  const filtered = useMemo(() => {
    if (!query.trim()) return goals;
    const term = query.trim().toLowerCase();
    const result: Goal[] = [];
    for (const group of goals) {
      if (group.title.toLowerCase().includes(term)) {
        result.push(group);
        continue;
      }
      const children = group.children?.filter((child) =>
        child.title.toLowerCase().includes(term),
      );
      if (children?.length) {
        result.push({ ...group, children });
      }
    }
    return result;
  }, [goals, query]);

  const totalCount = filtered.reduce(
    (count, group) => count + 1 + (group.children?.length ?? 0),
    0,
  );

  const selected = useMemo(() => {
    for (const group of goals) {
      if (group.id === selectedId) return { goal: group, parent: undefined };
      const child = group.children?.find((c) => c.id === selectedId);
      if (child) return { goal: child, parent: group.title };
    }
    return null;
  }, [goals, selectedId]);

  function toggleGroup(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-8 py-4">
        <div className="flex items-center gap-3">
          <label className="flex w-[280px] items-center gap-2 rounded-sm border border-border-subtle bg-surface-card px-3 py-2">
            <Search className="size-4 shrink-0 text-foreground-muted" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar metas..."
              className="w-full bg-transparent text-[13px] text-foreground-primary outline-none placeholder:text-foreground-muted"
            />
          </label>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-3 py-2 text-[13px] text-foreground-primary transition-colors hover:bg-surface-elevated"
          >
            <SlidersHorizontal className="size-3.5 text-foreground-muted" />
            Filtros
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-body text-xs text-foreground-muted">
            {totalCount} metas encontradas
          </span>
          <Link
            href="/dashboard/metas/nova"
            className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-4 py-2 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" />
            Nova Meta
          </Link>
        </div>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {filtered.map((group) => {
            const isCollapsed = collapsed.has(group.id);
            return (
              <div
                key={group.id}
                className="flex flex-col rounded-sm bg-surface-card py-1"
              >
                <SelectableRow
                  selected={selectedId === group.id}
                  onSelect={() => setSelectedId(group.id)}
                >
                  <GoalRow
                    goal={group}
                    className="min-w-0 flex-1"
                    chevron={
                      <button
                        type="button"
                        aria-label={
                          isCollapsed ? "Expandir grupo" : "Recolher grupo"
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleGroup(group.id);
                        }}
                        className="flex size-5 items-center justify-center text-foreground-muted hover:text-foreground-primary"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-3.5" />
                        ) : (
                          <ChevronDown className="size-3.5" />
                        )}
                      </button>
                    }
                  />
                </SelectableRow>
                {!isCollapsed &&
                  group.children?.map((child) => (
                    <SelectableRow
                      key={child.id}
                      selected={selectedId === child.id}
                      onSelect={() => setSelectedId(child.id)}
                    >
                      <GoalRow
                        goal={child}
                        subdued
                        className="min-w-0 flex-1"
                      />
                    </SelectableRow>
                  ))}
              </div>
            );
          })}
        </div>

        {selected && (
          <GoalDetailPanel
            goal={selected.goal}
            parentTitle={selected.parent}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  );
}

/**
 * Linha selecionável da árvore. `div role="button"` em vez de `<button>`
 * porque o chevron interno já é um botão (button aninhado é HTML inválido).
 */
function SelectableRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: contém botões aninhados (chevron/ações) — <button> dentro de <button> é HTML inválido
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group flex cursor-pointer items-center ${
        selected ? "bg-surface-elevated" : "hover:bg-surface-elevated/50"
      }`}
    >
      {children}
      <RowActions />
    </div>
  );
}

/** Ações de linha (editar/arquivar) — visuais, aparecem no hover. */
function RowActions() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 pr-3 opacity-0 transition-opacity group-hover:opacity-100">
      <Pencil className="size-3.5 text-foreground-muted" />
      <Archive className="size-3.5 text-foreground-muted" />
    </span>
  );
}
