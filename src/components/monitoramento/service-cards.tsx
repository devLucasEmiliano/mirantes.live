import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Cloud,
  Database,
  Radio,
  Server,
  Shield,
} from "lucide-react";
import { mockEndpointLatencies, mockServices } from "@/lib/mock-data";
import type { Service, ServiceIcon, ServiceState } from "@/lib/types";

const SERVICE_ICONS: Record<ServiceIcon, typeof Server> = {
  server: Server,
  database: Database,
  shield: Shield,
  cloud: Cloud,
  radio: Radio,
};

const STATE_TEXT: Record<ServiceState, { label: string; className: string }> = {
  online: { label: "Online", className: "text-status-done" },
  degraded: { label: "Lento", className: "text-accent-secondary" },
  offline: { label: "Offline", className: "text-status-overdue" },
};

const STATE_DOT: Record<ServiceState, string> = {
  online: "bg-status-done",
  degraded: "bg-accent-secondary",
  offline: "bg-status-overdue",
};

const STATE_ICON_COLOR: Record<ServiceState, string> = {
  online: "text-status-done",
  degraded: "text-accent-secondary",
  offline: "text-status-overdue",
};

const STATE_SEGMENT: Record<ServiceState, string> = {
  online: "bg-status-done",
  degraded: "bg-accent-secondary",
  offline: "bg-status-overdue",
};

/** Card "Status dos Serviços": ícone, nome, barra de uptime, % e estado. */
export function ServiceStatusCard() {
  return (
    <div className="flex flex-col gap-2 rounded-sm bg-surface-card p-5">
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-display text-sm font-bold text-foreground-primary">
          Status dos Serviços
        </h2>
        <span className="font-body text-[11px] text-foreground-muted">
          Atualizado agora
        </span>
      </div>
      {mockServices.map((service) => {
        const Icon = SERVICE_ICONS[service.icon];
        const state = STATE_TEXT[service.state];
        return (
          <div key={service.id} className="flex items-center gap-2.5 py-3">
            <Icon className={`size-3.5 ${STATE_ICON_COLOR[service.state]}`} />
            <span className="font-body text-[13px] text-foreground-primary">
              {service.name}
            </span>
            <span className="flex-1" />
            <span className="h-1.5 w-20 overflow-hidden rounded-[3px] bg-surface-elevated">
              <span
                className="block h-full bg-status-done"
                style={{ width: `${service.uptime30d}%` }}
              />
            </span>
            <span className="w-11 text-right font-body text-[11px] text-foreground-muted">
              {service.uptime30d}%
            </span>
            <span className="flex w-14 items-center gap-1">
              <span
                className={`size-1.5 rounded-full ${STATE_DOT[service.state]}`}
              />
              <span className={`font-body text-[11px] ${state.className}`}>
                {state.label}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Card "Uptime por Serviço": linha do tempo segmentada de 30 dias + legenda. */
export function UptimeByServiceCard() {
  return (
    <div className="flex flex-col gap-4 rounded-sm bg-surface-card p-5">
      <h2 className="font-display text-sm font-bold text-foreground-primary">
        Uptime por Serviço
      </h2>
      {mockServices.map((service) => (
        <ServiceTimelineRow key={service.id} service={service} />
      ))}
      <div className="flex items-center gap-4 pt-1">
        <Legend dotClass="bg-status-done" label="Operacional" />
        <Legend dotClass="bg-accent-secondary" label="Degradado" />
        <Legend dotClass="bg-status-overdue" label="Indisponível" />
      </div>
    </div>
  );
}

function ServiceTimelineRow({ service }: { service: Service }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[100px] shrink-0 font-body text-xs text-foreground-primary">
        {service.name}
      </span>
      <span className="flex h-5 flex-1 overflow-hidden rounded-[3px]">
        {service.history.map((state, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: série fixa de 30 dias sem reordenação
            key={index}
            className={`h-full flex-1 ${STATE_SEGMENT[state]}`}
          />
        ))}
      </span>
      <span className="w-11 shrink-0 text-right font-mono text-xs text-foreground-muted">
        {service.uptime30d}%
      </span>
    </div>
  );
}

function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span className="font-body text-[11px] text-foreground-muted">
        {label}
      </span>
    </span>
  );
}

const RECENT_INCIDENTS = [
  {
    id: "ri1",
    title: "CDN lentidão detectada",
    meta: "Hoje, 06:50 · em andamento",
    Icon: CircleAlert,
    colorClass: "text-accent-secondary",
  },
  {
    id: "ri2",
    title: "DB conexão perdida",
    meta: "21 Mai, 07:37 · 38 min",
    Icon: CircleX,
    colorClass: "text-status-overdue",
  },
  {
    id: "ri3",
    title: "API timeout (resolvido)",
    meta: "10 Jun, 18:28 · 12 min",
    Icon: CircleCheck,
    colorClass: "text-status-done",
  },
  {
    id: "ri4",
    title: "SSL certificado renovado",
    meta: "8 Jun, 03:00 · automático",
    Icon: CircleCheck,
    colorClass: "text-status-done",
  },
  {
    id: "ri5",
    title: "Memória alta (resolvido)",
    meta: "1 Jun, 14:12 · 25 min",
    Icon: CircleCheck,
    colorClass: "text-status-done",
  },
];

/** Card "Incidentes Recentes" da coluna direita. */
export function IncidentsCard() {
  return (
    <div className="flex flex-col gap-2 rounded-sm bg-surface-card p-5">
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-display text-sm font-bold text-foreground-primary">
          Incidentes Recentes
        </h2>
        <span className="font-body text-[11px] text-foreground-muted">
          3 este mês
        </span>
      </div>
      {RECENT_INCIDENTS.map(({ id, title, meta, Icon, colorClass }) => (
        <div key={id} className="flex items-center gap-2.5 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Icon className={`size-3.5 ${colorClass}`} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-body text-xs font-medium text-foreground-primary">
              {title}
            </span>
            <span className="font-body text-[11px] text-foreground-muted">
              {meta}
            </span>
          </div>
        </div>
      ))}
      <span className="my-2 h-px w-full bg-border-subtle" />
      <span className="text-center font-body text-xs font-medium text-accent-primary">
        Ver todos os incidentes →
      </span>
    </div>
  );
}

/** Card "Tempo de Resposta" (média 24h por endpoint). */
export function ResponseTimeCard() {
  const max = Math.max(...mockEndpointLatencies.map((e) => e.ms));
  return (
    <div className="flex flex-col gap-4 rounded-sm bg-surface-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold text-foreground-primary">
          Tempo de Resposta
        </h2>
        <span className="font-body text-[11px] text-foreground-muted">
          Média 24h
        </span>
      </div>
      {mockEndpointLatencies.map((entry) => (
        <div key={entry.endpoint} className="flex flex-col gap-1">
          <span className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-foreground-primary">
              {entry.endpoint}
            </span>
            <span className="font-mono text-[11px] font-semibold text-foreground-primary">
              {entry.ms}ms
            </span>
          </span>
          <span className="h-1 overflow-hidden rounded-[2px] bg-surface-elevated">
            <span
              className={`block h-full rounded-[2px] ${
                entry.slow ? "bg-accent-secondary" : "bg-status-done"
              }`}
              style={{ width: `${(entry.ms / max) * 100}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
