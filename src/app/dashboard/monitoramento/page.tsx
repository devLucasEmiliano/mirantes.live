import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import {
  IncidentsCard,
  ResponseTimeCard,
  ServiceStatusCard,
  UptimeByServiceCard,
} from "@/components/monitoramento/service-cards";
import { ProgressRing } from "@/components/shared/progress-ring";
import { StatCard } from "@/components/shared/stat-card";
import { UptimeDaysBar } from "@/components/shared/uptime-panel";
import {
  mockMonitoringSummary,
  mockProjectUptimeDays,
  mockServices,
} from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Monitoramento — Mirantes.Live",
};

export default function MonitoramentoPage() {
  const summary = mockMonitoringSummary;

  return (
    <>
      <AppHeader title="Monitoramento" breadcrumb="Dashboard / Monitoramento" />

      <div className="flex items-center justify-end gap-3 px-8 py-4">
        <span className="font-body text-xs text-foreground-muted">
          {mockServices.length} serviços monitorados
        </span>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-4 py-2 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Registrar Incidente
        </button>
      </div>

      <div className="flex gap-5 px-8 pb-6 pt-2">
        <StatCard title="Uptime Total" className="items-center">
          <ProgressRing
            value={97.9}
            size={100}
            strokeWidth={12}
            color="var(--color-status-done)"
            label={`${summary.totalUptime}%`}
          />
          <span className="font-body text-xs text-foreground-muted">
            disponibilidade mensal
          </span>
        </StatCard>

        <StatCard title="Serviços Online">
          <span className="font-mono text-[32px] font-bold leading-none text-status-done">
            {summary.servicesOnline}/{summary.servicesTotal}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            todos operacionais
          </span>
        </StatCard>

        <StatCard title="Tempo Médio">
          <span className="font-mono text-[32px] font-bold leading-none text-foreground-primary">
            {summary.avgLatencyMs}ms
          </span>
          <span className="font-body text-xs text-foreground-muted">
            tempo de resposta
          </span>
          <span className="mt-auto h-1.5 overflow-hidden rounded-[3px] bg-surface-elevated">
            <span className="block h-full w-[44%] rounded-[3px] bg-accent-secondary" />
          </span>
        </StatCard>

        <StatCard title="Incidentes">
          <span className="font-mono text-[32px] font-bold leading-none text-accent-secondary">
            {summary.incidents30d}
          </span>
          <span className="font-body text-xs text-foreground-muted">
            últimos 30 dias
          </span>
          <span className="font-body text-xs text-status-overdue">
            {summary.openIncidents} em andamento
          </span>
        </StatCard>
      </div>

      <div className="flex flex-1 gap-6 px-8 pb-8">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <ServiceStatusCard />
          <span className="h-px w-full bg-border-subtle" />
          <UptimeByServiceCard />
        </div>

        <div className="flex w-[360px] shrink-0 flex-col gap-5">
          <IncidentsCard />

          <div className="flex flex-col gap-4 rounded-sm bg-surface-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-foreground-primary">
                Uptime Geral
              </h2>
              <span className="font-body text-[11px] text-foreground-muted">
                Últimos 30 dias
              </span>
            </div>
            <div className="flex items-center gap-5">
              <ProgressRing
                value={97.9}
                size={100}
                strokeWidth={12}
                color="var(--color-status-done)"
                label={`${summary.totalUptime}%`}
              />
              <div className="flex flex-1 flex-col gap-2">
                <RingStat
                  dotClass="bg-status-done"
                  label="Operacional"
                  value="28 dias"
                />
                <RingStat
                  dotClass="bg-accent-secondary"
                  label="Degradado"
                  value="1 dia"
                />
                <RingStat
                  dotClass="bg-status-overdue"
                  label="Indisponível"
                  value="1 dia"
                />
              </div>
            </div>
            <span className="h-px w-full bg-border-subtle" />
            <div className="flex flex-col gap-2">
              <span className="font-display text-[13px] font-medium tracking-[0.3px] text-foreground-muted">
                Histórico de disponibilidade
              </span>
              <UptimeDaysBar
                days={mockProjectUptimeDays}
                startLabel="12 Mai"
                endLabel="11 Jun"
              />
            </div>
          </div>

          <ResponseTimeCard />
        </div>
      </div>
    </>
  );
}

function RingStat({
  dotClass,
  label,
  value,
}: {
  dotClass: string;
  label: string;
  value: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${dotClass}`} />
      <span className="font-body text-xs text-foreground-muted">{label}</span>
      <span className="flex-1" />
      <span className="font-mono text-xs text-foreground-primary">{value}</span>
    </span>
  );
}
