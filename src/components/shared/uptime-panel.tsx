import {
  Cloud,
  Database,
  Radio,
  Server,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { ProgressRing } from "@/components/shared/progress-ring";
import {
  mockIncidents,
  mockProjectUptimeDays,
  mockServices,
} from "@/lib/mock-data";
import {
  SERVICE_STATE_LABELS,
  type ServiceIcon,
  type ServiceState,
} from "@/lib/types";

const SERVICE_ICONS: Record<ServiceIcon, typeof Server> = {
  server: Server,
  database: Database,
  shield: Shield,
  cloud: Cloud,
  radio: Radio,
};

const STATE_COLORS: Record<ServiceState, string> = {
  online: "var(--color-status-done)",
  degraded: "var(--color-accent-secondary)",
  offline: "var(--color-status-overdue)",
};

const STATE_BAR_CLASSES: Record<ServiceState, string> = {
  online: "bg-status-done",
  degraded: "bg-accent-secondary",
  offline: "bg-status-overdue",
};

/** Barra de 30 células de uptime diário (design "Últimos 30 dias"). */
export function UptimeDaysBar({
  days,
  startLabel,
  endLabel,
  className,
}: {
  days: ServiceState[];
  startLabel?: string;
  endLabel?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex h-6 items-center gap-0.5">
        {days.map((state, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: lista fixa de 30 dias sem reordenação
            key={index}
            className={`h-full flex-1 rounded-[2px] ${STATE_BAR_CLASSES[state]}`}
          />
        ))}
      </div>
      {startLabel && endLabel && (
        <div className="flex justify-between pt-1">
          <span className="font-body text-[10px] text-foreground-muted">
            {startLabel}
          </span>
          <span className="font-body text-[10px] text-foreground-muted">
            {endLabel}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Painel "Uptime do Projeto" da Visão Geral/Home: ring de uptime,
 * status dos serviços, barra de 30 dias e incidentes recentes.
 */
export function UptimePanel() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex h-8 items-center justify-between">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          Uptime do Projeto
        </h2>
        <span className="font-body text-xs font-medium text-accent-primary">
          Últimos 30 dias
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-sm bg-surface-card p-4">
        <div className="flex flex-col items-center gap-2">
          <ProgressRing
            value={97.9}
            size={80}
            strokeWidth={10}
            color="var(--color-status-done)"
            label="99.7%"
          />
          <span className="font-body text-[13px] font-semibold text-status-done">
            Operacional
          </span>
        </div>

        <span className="h-px w-full bg-border-subtle" />

        <div className="flex flex-col gap-2.5">
          <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
            Status dos Serviços
          </span>
          {mockServices.map((service) => {
            const Icon = SERVICE_ICONS[service.icon];
            return (
              <div key={service.id} className="flex items-center gap-2">
                <Icon
                  className="size-3.5"
                  style={{ color: STATE_COLORS[service.state] }}
                />
                <span className="font-body text-[13px] text-foreground-primary">
                  {service.name}
                </span>
                <span className="flex-1" />
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: STATE_COLORS[service.state] }}
                  />
                  <span className="font-body text-[11px] text-foreground-muted">
                    {SERVICE_STATE_LABELS[service.state]}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        <span className="h-px w-full bg-border-subtle" />

        <div className="flex flex-col gap-2">
          <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
            Últimos 30 dias
          </span>
          <UptimeDaysBar
            days={mockProjectUptimeDays}
            startLabel="12 Mai"
            endLabel="11 Jun"
          />
        </div>

        <span className="h-px w-full bg-border-subtle" />

        <div className="flex flex-col gap-2">
          <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
            Incidentes Recentes
          </span>
          {mockIncidents.map((incident) => (
            <div key={incident.id} className="flex items-center gap-2 py-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    incident.status === "open" ? "#B54A4A15" : "#4A7A5B15",
                }}
              >
                <TriangleAlert
                  className="size-3"
                  style={{
                    color:
                      incident.status === "open"
                        ? "var(--color-status-overdue)"
                        : "var(--color-status-done)",
                  }}
                />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-body text-xs font-medium text-foreground-primary">
                  {incident.serviceName} — {incident.description}
                </span>
                <span className="font-body text-[11px] text-foreground-muted">
                  {incident.startedAt} · {incident.duration}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
