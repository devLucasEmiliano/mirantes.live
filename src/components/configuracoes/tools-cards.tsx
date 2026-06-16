import {
  Bell,
  ChevronRight,
  Cloud,
  Database,
  FileText,
  Moon,
  Radio,
  Server,
  Shield,
  Sigma,
  Table,
} from "lucide-react";
import { Toggle } from "@/components/configuracoes/toggle";
import { mockServices } from "@/lib/mock-data";
import type { ServiceIcon, ServiceState } from "@/lib/types";

const SERVICE_ICONS: Record<ServiceIcon, typeof Server> = {
  server: Server,
  database: Database,
  shield: Shield,
  cloud: Cloud,
  radio: Radio,
};

const STATE_BADGE: Record<ServiceState, { label: string; className: string }> =
  {
    online: { label: "Online", className: "bg-status-done" },
    degraded: { label: "Lento", className: "bg-accent-secondary" },
    offline: { label: "Offline", className: "bg-status-overdue" },
  };

const STATE_TEXT: Record<ServiceState, string> = {
  online: "text-status-done",
  degraded: "text-accent-secondary",
  offline: "text-status-overdue",
};

/** Card "Relatórios & Exportação": três atalhos de exportação. */
export function ReportsCard() {
  const actions = [
    {
      icon: FileText,
      circleClass: "bg-[#F0E6E0]",
      iconClass: "text-accent-primary",
      title: "Gerar Relatório PDF",
      description: "Exportar resumo completo do projeto",
    },
    {
      icon: Table,
      circleClass: "bg-[#F5EDE4]",
      iconClass: "text-accent-secondary",
      title: "Exportar Dados CSV",
      description: "Baixar metas e progresso em planilha",
    },
  ];

  return (
    <div className="flex flex-col rounded-sm bg-surface-card">
      <h2 className="border-b border-border-subtle px-6 py-5 font-display text-base font-bold text-foreground-primary">
        Relatórios &amp; Exportação
      </h2>
      <div className="flex flex-col py-2">
        {actions.map((action, index) => (
          <div key={action.title} className="flex flex-col">
            {index > 0 && <span className="mx-6 h-px bg-border-subtle" />}
            <button
              type="button"
              className="flex items-center gap-3.5 px-6 py-3.5 text-left transition-colors hover:bg-surface-elevated"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${action.circleClass}`}
              >
                <action.icon className={`size-[18px] ${action.iconClass}`} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground-primary">
                  {action.title}
                </span>
                <span className="font-body text-xs text-foreground-muted">
                  {action.description}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-foreground-muted" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card "Monitoramento de Uptime": serviços monitorados (admin). */
export function UptimeMonitoringCard() {
  return (
    <div className="flex flex-col rounded-sm bg-surface-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-6 py-5">
        <h2 className="font-display text-base font-bold text-foreground-primary">
          Monitoramento de Uptime
        </h2>
        <span className="flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-status-done" />
          <span className="font-body text-[10px] font-medium text-status-done">
            Ativo
          </span>
        </span>
      </div>
      <div className="flex flex-col py-2">
        {mockServices.map((service, index) => {
          const Icon = SERVICE_ICONS[service.icon];
          const badge = STATE_BADGE[service.state];
          return (
            <div key={service.id} className="flex flex-col">
              {index > 0 && <span className="mx-6 h-px bg-border-subtle" />}
              <div className="flex items-center justify-between gap-3 px-6 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-sm bg-surface-elevated">
                    <Icon className="size-4 text-foreground-primary" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-foreground-primary">
                      {service.name}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`size-2 rounded-full ${badge.className}`} />
                  <span
                    className={`font-body text-[11px] font-medium ${STATE_TEXT[service.state]}`}
                  >
                    {badge.label}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="flex items-center justify-center gap-2 border-t border-border-subtle px-6 py-3 text-[13px] font-medium text-accent-primary transition-colors hover:bg-surface-elevated"
      >
        <span className="text-base leading-none">+</span>
        Adicionar Serviço
      </button>
    </div>
  );
}

/** Card "Configurações de Projetos": toggles visuais. */
export function ProjectSettingsCard() {
  const settings = [
    {
      icon: Bell,
      circleClass: "bg-[#E8F0E8]",
      iconClass: "text-status-done",
      title: "Notificações em Tempo Real",
      description: "Atualizações ao vivo via SSE",
      defaultChecked: true,
    },
    {
      icon: Moon,
      circleClass: "bg-[#E8E8F0]",
      iconClass: "text-foreground-muted",
      title: "Modo Escuro",
      description: "Tema escuro da interface",
      defaultChecked: false,
    },
    {
      icon: Sigma,
      circleClass: "bg-[#F0E6E0]",
      iconClass: "text-accent-primary",
      title: "Cálculo Automático",
      description: "Derivar progresso das metas-pai",
      defaultChecked: true,
    },
  ];

  return (
    <div className="flex flex-col rounded-sm bg-surface-card">
      <h2 className="border-b border-border-subtle px-6 py-5 font-display text-base font-bold text-foreground-primary">
        Configurações de Projetos
      </h2>
      <div className="flex flex-col py-2">
        {settings.map((setting, index) => (
          <div key={setting.title} className="flex flex-col">
            {index > 0 && <span className="mx-6 h-px bg-border-subtle" />}
            <div className="flex items-center justify-between gap-3.5 px-6 py-3.5">
              <span className="flex items-center gap-3.5">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${setting.circleClass}`}
                >
                  <setting.icon
                    className={`size-[18px] ${setting.iconClass}`}
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground-primary">
                    {setting.title}
                  </span>
                  <span className="font-body text-xs text-foreground-muted">
                    {setting.description}
                  </span>
                </span>
              </span>
              <Toggle
                defaultChecked={setting.defaultChecked}
                label={setting.title}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card "Zona de Perigo": ações destrutivas (visuais). */
export function DangerZoneCard() {
  return (
    <div className="flex flex-col rounded-sm border-t-2 border-status-overdue bg-surface-card">
      <h2 className="border-b border-border-subtle px-6 py-5 font-display text-base font-bold text-status-overdue">
        Zona de Perigo
      </h2>
      <div className="flex flex-col gap-3 px-6 py-5">
        <p className="text-[13px] text-foreground-muted">
          Ações irreversíveis que afetam todo o projeto.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            className="rounded-sm border border-status-overdue px-4 py-2.5 text-[13px] font-medium text-status-overdue transition-colors hover:bg-status-overdue/5"
          >
            Arquivar Todas as Metas
          </button>
          <button
            type="button"
            className="rounded-sm bg-status-overdue px-4 py-2.5 text-[13px] font-medium text-foreground-inverse transition-opacity hover:opacity-90"
          >
            Resetar Projeto
          </button>
        </div>
      </div>
    </div>
  );
}
