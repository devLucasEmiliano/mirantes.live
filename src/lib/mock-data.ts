// Dados mock do front-end. Os valores espelham o design (desing.pen):
// 18 metas, 12 concluídas, 4 em andamento, 2 atrasadas, commits 47 (+12%),
// tempo médio 3.2d, 5/5 serviços online, 142ms, 3 incidentes em 30 dias.
// Nenhum dado vem de banco — esta camada será substituída pela API real.

import type {
  Goal,
  Incident,
  Service,
  ServiceState,
  TimelineEvent,
} from "./types";

export const mockUser = {
  name: "Lucas Cliente",
  initials: "LC",
  role: "Cliente",
  email: "cliente@mirantes.live",
};

export const mockProject = {
  name: "Mirantes.Live Dashboard",
  description: "Dashboard de progresso para acompanhamento do projeto",
  startedAt: "2026-03-02",
};

export const mockSummary = {
  totalGoals: 18,
  completedGoals: 12,
  inProgressGoals: 4,
  overdueGoals: 2,
  nextDueDate: "3 Jun",
  /** % agregado do projeto (média das metas de topo). */
  totalProgress: 68,
  /** Saúde = 0.5·progresso + 0.3·pontualidade + 0.2·uptime (PRD §5). */
  health: 87,
  weeklyCommits: 47,
  weeklyCommitsDelta: "+12% vs semana anterior",
  avgCompletionDays: 3.2,
};

export const mockGoals: Goal[] = [
  {
    id: "g1",
    title: "Desenvolvimento do Backend",
    status: "in_progress",
    progress: 75,
    dueDate: "2026-06-30",
    children: [
      {
        id: "g1-1",
        title: "API de Autenticação",
        status: "done",
        progress: 100,
        dueDate: "2026-06-01",
        description:
          "Login com email/senha, cookie httpOnly e sessão sliding de 7 dias.",
      },
      {
        id: "g1-2",
        title: "Endpoints de Metas",
        status: "in_progress",
        progress: 60,
        dueDate: "2026-06-10",
        description:
          "Route Handlers de criação, edição e arquivamento em cascata.",
      },
      {
        id: "g1-3",
        title: "Integração Redis/SSE",
        status: "todo",
        progress: 0,
        dueDate: "2026-06-15",
        description:
          "Canal de eventos com reconexão via Last-Event-ID e heartbeat.",
      },
    ],
  },
  {
    id: "g2",
    title: "Design do Frontend",
    status: "done",
    progress: 100,
    dueDate: "2026-05-20",
    children: [
      {
        id: "g2-1",
        title: "Sistema de design e tokens",
        status: "done",
        progress: 100,
        dueDate: "2026-04-22",
        description: "Paleta, tipografia e componentes base no Pencil.",
      },
      {
        id: "g2-2",
        title: "Telas do dashboard",
        status: "done",
        progress: 100,
        dueDate: "2026-05-10",
        description:
          "Visão Geral, Metas, Timeline, Monitoramento e Configurações.",
      },
      {
        id: "g2-3",
        title: "Componentes compartilhados",
        status: "done",
        progress: 100,
        dueDate: "2026-05-20",
        description: "Goal Row, Project Switcher, cards de estatística.",
      },
    ],
  },
  {
    id: "g3",
    title: "Infraestrutura & Deploy",
    status: "in_progress",
    progress: 57,
    dueDate: "2026-07-10",
    children: [
      {
        id: "g3-1",
        title: "Docker Compose (app + Postgres + Redis)",
        status: "done",
        progress: 100,
        dueDate: "2026-05-25",
        description: "Ambiente reproduzível de desenvolvimento e produção.",
      },
      {
        id: "g3-2",
        title: "Pipeline de CI/CD",
        status: "in_progress",
        progress: 70,
        dueDate: "2026-06-03",
        overdue: true,
        description:
          "Build, lint e testes a cada push; deploy automático na VPS.",
      },
      {
        id: "g3-3",
        title: "VPS + Nginx (SSE-ready)",
        status: "todo",
        progress: 0,
        dueDate: "2026-07-10",
        description: "proxy_buffering off e timeouts altos para o stream.",
      },
    ],
  },
  {
    id: "g4",
    title: "Testes & QA",
    status: "in_progress",
    progress: 73,
    dueDate: "2026-07-01",
    children: [
      {
        id: "g4-1",
        title: "Testes unitários (Vitest)",
        status: "done",
        progress: 100,
        dueDate: "2026-05-15",
        description: "Derivação de progresso/status e fórmula de saúde.",
      },
      {
        id: "g4-2",
        title: "Testes de integração (infra real)",
        status: "done",
        progress: 100,
        dueDate: "2026-06-05",
        description: "Route Handlers com Postgres e Redis via Testcontainers.",
      },
      {
        id: "g4-3",
        title: "E2E (Playwright)",
        status: "in_progress",
        progress: 20,
        dueDate: "2026-06-08",
        overdue: true,
        description: "Jornadas de login, dashboard e atualização ao vivo.",
      },
    ],
  },
  {
    id: "g5",
    title: "Documentação",
    status: "done",
    progress: 100,
    dueDate: "2026-05-30",
    description: "PRD, SPEC e DOC.md por pasta atualizados.",
  },
];

export const mockEvents: TimelineEvent[] = [
  {
    id: 124,
    source: "goal",
    type: "goal.completed",
    title: "API de Autenticação concluída",
    detail: "Progresso atualizado para 100%",
    timestamp: "Hoje, 14:32",
    visibleToClient: true,
  },
  {
    id: 123,
    source: "commit",
    type: "commit.batch",
    title: "8 commits em mirantes.live",
    detail: "feat: canal SSE com replay por Last-Event-ID",
    timestamp: "Hoje, 12:50",
    visibleToClient: true,
  },
  {
    id: 122,
    source: "goal",
    type: "goal.updated",
    title: "Dashboard Principal atualizado",
    detail: "Progresso: 30% → 40%",
    timestamp: "Hoje, 11:15",
    visibleToClient: true,
  },
  {
    id: 121,
    source: "goal",
    type: "goal.created",
    title: "CI/CD Pipeline criada",
    detail: "Nova meta adicionada",
    timestamp: "Ontem, 18:45",
    visibleToClient: true,
  },
  {
    id: 120,
    source: "incident",
    type: "incident.resolved",
    title: "Incidente resolvido: API Backend",
    detail: "Duração: 12 min — latência acima do threshold",
    timestamp: "Ontem, 18:40",
    visibleToClient: true,
  },
  {
    id: 119,
    source: "goal",
    type: "goal.completed",
    title: "Tela de Login concluída",
    detail: "Status alterado para concluído",
    timestamp: "Ontem, 16:20",
    visibleToClient: true,
  },
  {
    id: 118,
    source: "commit",
    type: "commit.batch",
    title: "5 commits em mirantes.live",
    detail: "fix: anti-flapping no worker de polling",
    timestamp: "Ontem, 11:03",
    visibleToClient: true,
  },
  {
    id: 117,
    source: "goal",
    type: "goal.updated",
    title: "Endpoints de Metas atualizado",
    detail: "Progresso: 45% → 60%",
    timestamp: "28 Mai, 10:30",
    visibleToClient: true,
  },
  {
    id: 116,
    source: "goal",
    type: "goal.created",
    title: "Configuração Docker criada",
    detail: "Nova meta adicionada",
    timestamp: "27 Mai, 09:00",
    visibleToClient: true,
  },
  {
    id: 115,
    source: "goal",
    type: "goal.updated",
    title: "Integração Redis/SSE",
    detail: "Data prevista definida: 15 Jun",
    timestamp: "26 Mai, 15:45",
    visibleToClient: true,
  },
  {
    id: 114,
    source: "incident",
    type: "incident.resolved",
    title: "Incidente resolvido: Banco de Dados",
    detail: "Duração: 38 min — conexão perdida",
    timestamp: "21 Mai, 08:15",
    visibleToClient: false,
  },
];

/** 30 dias de uptime: "online" por padrão, com exceções por dia (1-indexado). */
function uptimeDays(
  overrides: Record<number, ServiceState> = {},
): ServiceState[] {
  return Array.from({ length: 30 }, (_, i) => overrides[i + 1] ?? "online");
}

/** Barra "Últimos 30 dias" do projeto (design: dia 7 degradado, dia 21 offline). */
export const mockProjectUptimeDays = uptimeDays({
  7: "degraded",
  21: "offline",
});

export const mockServices: Service[] = [
  {
    id: "s1",
    name: "API Backend",
    checkType: "http",
    target: "https://api.mirantes.live/health",
    icon: "server",
    state: "online",
    uptime30d: 99.8,
    latencyMs: 86,
    history: uptimeDays({ 21: "offline" }),
  },
  {
    id: "s2",
    name: "Banco de Dados",
    checkType: "docker",
    target: "guia-postgres",
    icon: "database",
    state: "online",
    uptime30d: 99.9,
    latencyMs: 12,
    history: uptimeDays({ 24: "offline" }),
  },
  {
    id: "s3",
    name: "Autenticação",
    checkType: "http",
    target: "https://api.mirantes.live/auth/health",
    icon: "shield",
    state: "online",
    uptime30d: 100,
    latencyMs: 94,
    history: uptimeDays(),
  },
  {
    id: "s4",
    name: "CDN / Assets",
    checkType: "http",
    target: "https://cdn.mirantes.live",
    icon: "cloud",
    state: "degraded",
    uptime30d: 99.1,
    latencyMs: 412,
    history: uptimeDays({ 7: "degraded", 28: "degraded" }),
  },
  {
    id: "s5",
    name: "WebSocket",
    checkType: "docker",
    target: "guia-realtime",
    icon: "radio",
    state: "online",
    uptime30d: 99.6,
    latencyMs: 38,
    history: uptimeDays({ 11: "degraded" }),
  },
];

export const mockMonitoringSummary = {
  totalUptime: 99.7,
  servicesOnline: 5,
  servicesTotal: 5,
  avgLatencyMs: 142,
  incidents30d: 3,
  openIncidents: 1,
};

/** Tempo de resposta médio (24h) por endpoint — card "Tempo de Resposta". */
export const mockEndpointLatencies = [
  { endpoint: "GET /api/goals", ms: 89, slow: false },
  { endpoint: "POST /api/auth", ms: 142, slow: false },
  { endpoint: "GET /api/timeline", ms: 205, slow: true },
  { endpoint: "WS /realtime", ms: 45, slow: false },
  { endpoint: "GET /api/users", ms: 112, slow: false },
];

export const mockIncidents: Incident[] = [
  {
    id: "i1",
    serviceName: "CDN / Assets",
    origin: "auto",
    status: "open",
    startedAt: "11 Jun, 06:50",
    duration: "em andamento",
    description: "Lentidão detectada — latência acima do threshold.",
  },
  {
    id: "i2",
    serviceName: "API Backend",
    origin: "auto",
    status: "resolved",
    startedAt: "10 Jun, 18:28",
    duration: "12 min",
    description: "Timeout nas requisições após deploy.",
  },
  {
    id: "i3",
    serviceName: "Banco de Dados",
    origin: "auto",
    status: "resolved",
    startedAt: "21 Mai, 07:37",
    duration: "38 min",
    description: "Conexão perdida; container reiniciado.",
  },
];
