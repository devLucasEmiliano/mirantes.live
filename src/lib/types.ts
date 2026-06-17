// Tipos de domínio do front-end. Espelham o SPEC §2 (schema PostgreSQL),
// mas sem campos de infra (deleted_at, position) que não aparecem na UI mock.

export type GoalStatus = "todo" | "in_progress" | "done";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  todo: "A Fazer",
  in_progress: "Em Progresso",
  done: "Concluído",
};

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;
  /** 0–100. Em metas-pai é derivado (média dos filhos) — read-only na UI. */
  progress: number;
  /** Data prevista (obrigatória no PRD §4.1), ISO `AAAA-MM-DD`. */
  dueDate: string;
  /** Atrasada = dueDate no passado e status ≠ done (PRD §4.5). */
  overdue?: boolean;
  description?: string;
  children?: Goal[];
}

export type EventSource = "goal" | "commit" | "incident";

export interface TimelineEvent {
  /** `events.id` (bigint) serializado com String() — JSON-safe; âncora do SSE (spec 014). */
  id: string;
  source: EventSource;
  type: string;
  title: string;
  detail?: string;
  /** ISO 8601 — tempo da ATIVIDADE (commit/run). Formatado na UI via `events/format.ts`. */
  createdAt: string;
  visibleToClient: boolean;
}

export type ServiceState = "online" | "degraded" | "offline";

export const SERVICE_STATE_LABELS: Record<ServiceState, string> = {
  online: "Online",
  degraded: "Degradado",
  offline: "Offline",
};

/** Ícone lucide associado ao serviço no design. */
export type ServiceIcon = "server" | "database" | "shield" | "cloud" | "radio";

export interface Service {
  id: string;
  name: string;
  checkType: "http" | "docker";
  target: string;
  icon: ServiceIcon;
  state: ServiceState;
  /** Uptime % na janela de 30 dias. */
  uptime30d: number;
  latencyMs: number | null;
  /** Últimos 30 dias para a barra de uptime (mais antigo → mais recente). */
  history: ServiceState[];
}

export interface Incident {
  id: string;
  serviceName: string;
  origin: "auto" | "manual";
  status: "open" | "resolved";
  startedAt: string;
  duration: string;
  description: string;
}
