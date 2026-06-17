"use client";

import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { eventVisual } from "@/components/shared/event-visual";
import { eventDateGroup, eventTime } from "@/lib/events/format";
import type { TimelineEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTER_CHIPS = [
  { key: "all", label: "Todos" },
  { key: "completed", label: "Concluído" },
  { key: "updated", label: "Atualizado" },
  { key: "created", label: "Criado" },
  { key: "archived", label: "Arquivado" },
] as const;

type FilterKey = (typeof FILTER_CHIPS)[number]["key"];

interface TimelineViewProps {
  events: TimelineEvent[];
  /** Cursor da próxima página (`events.id`) ou null se acabou. */
  nextCursor: string | null;
  /** Projeto selecionado (filtra o "carregar mais"); undefined = todo o escopo. */
  projectId?: string;
  /** "Agora" do servidor (ISO) p/ agrupar Hoje/Ontem de forma determinística. */
  nowIso: string;
  /** Contagens reais da semana (7d) p/ o painel RESUMO. */
  weekSummary: { commits: number; ci: number; total: number };
}

/**
 * Conteúdo da página Timeline: feed real (events) agrupado por dia + painel lateral de busca,
 * filtros por tipo e resumo da semana. "Carregar mais" pagina via GET /api/events (cursor).
 * Sem SSE ainda (spec 014) — lê do banco a cada carga/navegação.
 */
export function TimelineView({
  events,
  nextCursor,
  projectId,
  nowIso,
  weekSummary,
}: TimelineViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [extra, setExtra] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);

  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const all = useMemo(() => [...events, ...extra], [events, extra]);

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cursor, limit: "30" });
      if (projectId) params.set("projectId", projectId);
      const res = await fetch(`/api/events?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          events: TimelineEvent[];
          nextCursor: string | null;
        };
        setExtra((prev) => [...prev, ...data.events]);
        setCursor(data.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, projectId]);

  const filtered = useMemo(() => {
    return all.filter((event) => {
      if (filter !== "all" && !event.type.endsWith(`.${filter}`)) return false;
      if (!query.trim()) return true;
      const term = query.trim().toLowerCase();
      return (
        event.title.toLowerCase().includes(term) ||
        event.detail?.toLowerCase().includes(term)
      );
    });
  }, [all, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of filtered) {
      const group = eventDateGroup(new Date(event.createdAt), now);
      map.set(group, [...(map.get(group) ?? []), event]);
    }
    return [...map.entries()];
  }, [filtered, now]);

  return (
    <div className="flex flex-1 gap-6 px-8 py-6">
      {/* Feed */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-sm bg-surface-card">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-base font-bold text-foreground-primary">
            Histórico de Atividades
          </h2>
          <span className="font-body text-xs text-foreground-muted">
            {filtered.length} eventos
          </span>
        </div>

        {groups.map(([label, groupEvents]) => (
          <div key={label} className="flex flex-col">
            <div className="bg-surface-elevated px-5 py-3">
              <span className="font-body text-xs font-bold text-foreground-primary">
                {label}
              </span>
            </div>
            {groupEvents.map((event, index) => {
              const { Icon, color } = eventVisual(event);
              return (
                <div key={event.id} className="flex flex-col">
                  {index > 0 && <span className="mx-5 h-px bg-border-subtle" />}
                  <div className="flex gap-3.5 px-5 py-4">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}1A` }}
                    >
                      <Icon className="size-4" style={{ color }} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-foreground-primary">
                        {event.title}
                      </span>
                      {event.detail && (
                        <span className="text-[13px] text-foreground-muted">
                          {event.detail}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-body text-xs text-foreground-muted">
                      {eventTime(new Date(event.createdAt))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {filtered.length === 0 && (
          <span className="px-5 py-8 text-center font-body text-sm text-foreground-muted">
            Nenhum evento encontrado.
          </span>
        )}

        {cursor && (
          <div className="flex justify-center border-t border-border-subtle px-5 py-4">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="rounded-full bg-surface-elevated px-4 py-1.5 text-xs text-foreground-primary transition-colors hover:bg-border-subtle disabled:opacity-50"
            >
              {loading ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        )}
      </div>

      {/* Painel lateral */}
      <div className="flex w-[300px] shrink-0 flex-col gap-4">
        <label className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-card px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-foreground-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar eventos..."
            className="w-full bg-transparent text-[13px] text-foreground-primary outline-none placeholder:text-foreground-muted"
          />
        </label>

        <div className="flex flex-col gap-3.5 rounded-sm bg-surface-card p-4">
          <span className="font-body text-xs font-bold tracking-[1px] text-foreground-primary">
            FILTRAR POR TIPO
          </span>
          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  filter === chip.key
                    ? "bg-accent-primary text-foreground-inverse"
                    : "bg-surface-elevated text-foreground-primary hover:bg-border-subtle",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <span className="font-body text-xs font-bold tracking-[1px] text-foreground-primary">
            PERÍODO
          </span>
          <div className="flex gap-2">
            <span className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3 py-2 text-xs text-foreground-primary">
              De: 12 Mai
            </span>
            <span className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3 py-2 text-xs text-foreground-primary">
              Até: 11 Jun
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3.5 rounded-sm bg-surface-card p-4">
          <span className="font-body text-xs font-bold tracking-[1px] text-foreground-primary">
            RESUMO DA SEMANA
          </span>
          <div className="flex flex-col gap-2.5">
            <SummaryStat
              label="Commits"
              value={String(weekSummary.commits)}
              valueClass="text-accent-primary"
            />
            <SummaryStat
              label="Execuções de CI"
              value={String(weekSummary.ci)}
              valueClass="text-accent-tertiary"
            />
            <SummaryStat
              label="Total de eventos"
              value={String(weekSummary.total)}
              valueClass="text-foreground-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <span className="flex items-center justify-between">
      <span className="text-[13px] text-foreground-muted">{label}</span>
      <span className={`font-mono text-sm font-bold ${valueClass}`}>
        {value}
      </span>
    </span>
  );
}
