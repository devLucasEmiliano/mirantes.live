"use client";

import {
  Archive,
  CircleCheckBig,
  CirclePlus,
  GitCommitHorizontal,
  Pencil,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
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

/** Ícone/cor dos eventos no feed da Timeline (paleta desta tela no design). */
function feedVisual(event: TimelineEvent): {
  Icon: typeof Pencil;
  color: string;
} {
  if (event.source === "commit") {
    return { Icon: GitCommitHorizontal, color: "#8F5A3C" };
  }
  if (event.source === "incident") {
    return event.type === "incident.opened"
      ? { Icon: TriangleAlert, color: "#B54A4A" }
      : { Icon: CircleCheckBig, color: "#4A7A5B" };
  }
  if (event.type.endsWith(".completed")) {
    return { Icon: CircleCheckBig, color: "#4A7A5B" };
  }
  if (event.type.endsWith(".created")) {
    return { Icon: CirclePlus, color: "#A38979" };
  }
  if (event.type.endsWith(".archived")) {
    return { Icon: Archive, color: "#999999" };
  }
  return { Icon: Pencil, color: "#8F5A3C" };
}

/** "Hoje, 14:32" → grupo "Hoje — 11 Jun 2026"; "28 Mai, 10:30" → "28 Mai 2026". */
function dateGroupOf(event: TimelineEvent): string {
  const prefix = event.timestamp.split(",")[0];
  if (prefix === "Hoje") return "Hoje — 11 Jun 2026";
  if (prefix === "Ontem") return "Ontem — 10 Jun 2026";
  return `${prefix} 2026`;
}

function timeOf(event: TimelineEvent): string {
  return event.timestamp.split(", ")[1] ?? event.timestamp;
}

interface TimelineViewProps {
  events: TimelineEvent[];
}

/**
 * Conteúdo da página Timeline: feed agrupado por dia + painel lateral
 * de busca, filtros por tipo, resumo da semana e metas mais ativas.
 */
export function TimelineView({ events }: TimelineViewProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (filter !== "all" && !event.type.endsWith(`.${filter}`)) return false;
      if (!query.trim()) return true;
      const term = query.trim().toLowerCase();
      return (
        event.title.toLowerCase().includes(term) ||
        event.detail?.toLowerCase().includes(term)
      );
    });
  }, [events, filter, query]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of filtered) {
      const group = dateGroupOf(event);
      map.set(group, [...(map.get(group) ?? []), event]);
    }
    return [...map.entries()];
  }, [filtered]);

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
              const { Icon, color } = feedVisual(event);
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
                      {timeOf(event)}
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
              label="Metas concluídas"
              value="3"
              valueClass="text-status-done"
            />
            <SummaryStat
              label="Atualizações"
              value="8"
              valueClass="text-accent-primary"
            />
            <SummaryStat
              label="Metas criadas"
              value="4"
              valueClass="text-accent-tertiary"
            />
            <SummaryStat
              label="Total de eventos"
              value="15"
              valueClass="text-foreground-primary"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-sm bg-surface-card p-4">
          <span className="font-body text-xs font-bold tracking-[1px] text-foreground-primary">
            METAS MAIS ATIVAS
          </span>
          <ActiveGoal
            dotClass="bg-accent-secondary"
            name="Dashboard Principal"
            events="5 eventos"
          />
          <ActiveGoal
            dotClass="bg-status-done"
            name="API de Autenticação"
            events="4 eventos"
          />
          <ActiveGoal
            dotClass="bg-accent-primary"
            name="Endpoints de Metas"
            events="3 eventos"
          />
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

function ActiveGoal({
  dotClass,
  name,
  events,
}: {
  dotClass: string;
  name: string;
  events: string;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`size-2 shrink-0 rounded-full ${dotClass}`} />
      <span className="flex-1 truncate text-[13px] text-foreground-primary">
        {name}
      </span>
      <span className="shrink-0 font-body text-[11px] text-foreground-muted">
        {events}
      </span>
    </span>
  );
}
