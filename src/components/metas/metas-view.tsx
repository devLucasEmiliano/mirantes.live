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
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GoalDetailPanel } from "@/components/metas/goal-detail-panel";
import { GoalRow } from "@/components/metas/goal-row";
import type { Goal } from "@/lib/types";

interface MetasViewProps {
  goals: Goal[];
  /** Admin pode editar/arquivar; cliente é read-only (spec 013). */
  canMutate?: boolean;
}

/**
 * Conteúdo interativo da página de Metas REAIS (spec 013): busca, árvore recursiva
 * (profundidade ilimitada), seleção → painel de detalhe e mutações (arquivar/editar) via
 * `fetch` + `router.refresh()`. Sem `mockGoals`.
 */
export function MetasView({ goals, canMutate = false }: MetasViewProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => filterTree(goals, query), [goals, query]);
  const totalCount = useMemo(() => countTree(filtered), [filtered]);
  const selected = useMemo(
    () => findInTree(goals, selectedId),
    [goals, selectedId],
  );

  function toggleGroup(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function archiveGoal(id: string) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/goals/${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    setSelectedId((cur) => (cur === id ? null : cur));
    router.refresh();
  }

  async function patchGoal(id: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
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
          {canMutate && (
            <Link
              href="/dashboard/metas/nova"
              className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-4 py-2 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
            >
              <Plus className="size-4" />
              Nova Meta
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {filtered.length === 0 ? (
            <p className="rounded-sm bg-surface-card p-6 text-center text-[13px] text-foreground-muted">
              Nenhuma meta neste projeto ainda.
            </p>
          ) : (
            filtered.map((group) => (
              <div
                key={group.id}
                className="flex flex-col rounded-sm bg-surface-card py-1"
              >
                <GoalTree
                  goal={group}
                  depth={0}
                  collapsed={collapsed}
                  onToggle={toggleGroup}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  canMutate={canMutate}
                  onArchive={archiveGoal}
                />
              </div>
            ))
          )}
        </div>

        {selected && (
          <GoalDetailPanel
            goal={selected.goal}
            parentTitle={selected.parent}
            canMutate={canMutate}
            onClose={() => setSelectedId(null)}
            onArchive={() => archiveGoal(selected.goal.id)}
            onChangeStatus={(status) => patchGoal(selected.goal.id, { status })}
          />
        )}
      </div>
    </>
  );
}

interface GoalTreeProps {
  goal: Goal;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  canMutate: boolean;
  onArchive: (id: string) => void;
}

/** Nó recursivo da árvore — renderiza a linha e, se expandido, os filhos (indentados). */
function GoalTree({
  goal,
  depth,
  collapsed,
  onToggle,
  selectedId,
  onSelect,
  canMutate,
  onArchive,
}: GoalTreeProps) {
  const hasChildren = (goal.children?.length ?? 0) > 0;
  const isCollapsed = collapsed.has(goal.id);

  return (
    <>
      <SelectableRow
        selected={selectedId === goal.id}
        onSelect={() => onSelect(goal.id)}
        canMutate={canMutate}
        onArchive={() => onArchive(goal.id)}
      >
        <span
          className="min-w-0 flex-1"
          style={depth > 1 ? { marginLeft: (depth - 1) * 20 } : undefined}
        >
          <GoalRow
            goal={goal}
            subdued={depth > 0}
            className="min-w-0 flex-1"
            chevron={
              hasChildren ? (
                <button
                  type="button"
                  aria-label={isCollapsed ? "Expandir grupo" : "Recolher grupo"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(goal.id);
                  }}
                  className="flex size-5 items-center justify-center text-foreground-muted hover:text-foreground-primary"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
              ) : null
            }
          />
        </span>
      </SelectableRow>
      {hasChildren &&
        !isCollapsed &&
        goal.children?.map((child) => (
          <GoalTree
            key={child.id}
            goal={child}
            depth={depth + 1}
            collapsed={collapsed}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
            canMutate={canMutate}
            onArchive={onArchive}
          />
        ))}
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
  canMutate,
  onArchive,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  canMutate: boolean;
  onArchive: () => void;
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
      {canMutate && <RowActions onArchive={onArchive} />}
    </div>
  );
}

/** Ações de linha (editar/arquivar) — aparecem no hover; só p/ admin. */
function RowActions({ onArchive }: { onArchive: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 pr-3 opacity-0 transition-opacity group-hover:opacity-100">
      <Pencil className="size-3.5 text-foreground-muted" />
      <button
        type="button"
        aria-label="Arquivar meta"
        onClick={(event) => {
          event.stopPropagation();
          onArchive();
        }}
        className="text-foreground-muted transition-colors hover:text-status-overdue"
      >
        <Archive className="size-3.5" />
      </button>
    </span>
  );
}

// --- Helpers puros da árvore ---

function filterTree(goals: Goal[], query: string): Goal[] {
  const term = query.trim().toLowerCase();
  if (!term) return goals;
  const walk = (list: Goal[]): Goal[] =>
    list.flatMap((g) => {
      if (g.title.toLowerCase().includes(term)) return [g];
      const kids = walk(g.children ?? []);
      return kids.length > 0 ? [{ ...g, children: kids }] : [];
    });
  return walk(goals);
}

function countTree(goals: Goal[]): number {
  return goals.reduce((n, g) => n + 1 + countTree(g.children ?? []), 0);
}

function findInTree(
  goals: Goal[],
  id: string | null,
  parentTitle?: string,
): { goal: Goal; parent?: string } | null {
  if (!id) return null;
  for (const g of goals) {
    if (g.id === id) return { goal: g, parent: parentTitle };
    const found = findInTree(g.children ?? [], id, g.title);
    if (found) return found;
  }
  return null;
}
