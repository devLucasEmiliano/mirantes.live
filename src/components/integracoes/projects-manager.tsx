"use client";

import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommit,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";
import {
  deriveRunStatus,
  isValidRepoSlug,
  type RunStatus,
} from "@/lib/github/map";

// Gerência de projetos (spec 008 → 009, em Integrações). Lista, adiciona, remove,
// sincroniza e, ao expandir, mostra o log de atividade (commits/branches/último run).
// Fala SÓ com a API via fetch (nada de Prisma/segredo aqui); o gate de auth (admin+
// cliente) é da página. Cada usuário gere os SEUS projetos. Após cada mutação chama
// router.refresh() (re-renderiza o Server Component).

export interface ProjectListItem {
  id: string;
  name: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  /** ISO 8601 ou null — usado p/ o badge de conexão. */
  lastPolledAt: string | null;
}

interface ActivityCommit {
  sha: string;
  message: string;
  author: string;
  committedAt: string;
}
interface ActivityBranch {
  name: string;
  commitSha: string;
  isDefault: boolean;
}
interface ActivityRun {
  runId: string;
  name: string;
  status: string;
  conclusion: string | null;
  htmlUrl: string;
}
interface Activity {
  commits: ActivityCommit[];
  branches: ActivityBranch[];
  workflowRuns: ActivityRun[];
}

type ActivityState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; data: Activity };

const RUN_BADGE: Record<RunStatus, { label: string; className: string }> = {
  success: {
    label: "Sucesso",
    className: "bg-status-done/15 text-status-done",
  },
  failure: {
    label: "Falhou",
    className: "bg-status-overdue/15 text-status-overdue",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-surface-elevated text-foreground-muted",
  },
  running: {
    label: "Rodando",
    className: "bg-accent-secondary/15 text-accent-secondary",
  },
  queued: {
    label: "Na fila",
    className: "bg-surface-elevated text-foreground-muted",
  },
  neutral: {
    label: "—",
    className: "bg-surface-elevated text-foreground-muted",
  },
};

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function ProjectsManager({
  projects,
  connection,
}: {
  projects: ProjectListItem[];
  /** Conexão GitHub do usuário atual — define o badge e a mensagem de sync. */
  connection: { connected: boolean; githubLogin: string | null };
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<Record<string, ActivityState>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function loadActivity(id: string) {
    setActivity((prev) => ({ ...prev, [id]: { phase: "loading" } }));
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { project: Activity };
      setActivity((prev) => ({
        ...prev,
        [id]: { phase: "ready", data: json.project },
      }));
    } catch {
      setActivity((prev) => ({ ...prev, [id]: { phase: "error" } }));
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!activity[id]) void loadActivity(id);
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);
    if (!isValidRepoSlug(owner.trim(), repo.trim())) {
      setAddError("Owner e repositório inválidos (sem espaços ou barras).");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          owner: owner.trim(),
          repo: repo.trim(),
        }),
      });
      if (res.ok) {
        setName("");
        setOwner("");
        setRepo("");
        router.refresh();
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (res.status === 409 || json?.error === "already_exists") {
        setAddError("Esse repositório já está cadastrado.");
      } else {
        setAddError("Não foi possível adicionar o projeto.");
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleSync(id: string) {
    setBusyId(id);
    setFeedback((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/projects/${id}/sync`, { method: "POST" });
      if (res.ok) {
        setFeedback((prev) => ({ ...prev, [id]: "Sincronizado com sucesso." }));
        setActivity((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (expandedId === id) void loadActivity(id);
        router.refresh();
        return;
      }
      const message =
        res.status === 409
          ? "Conecte sua conta do GitHub para sincronizar."
          : res.status === 404
            ? "Projeto não encontrado."
            : res.status === 502
              ? "Falha ao acessar o GitHub."
              : "Não foi possível sincronizar.";
      setFeedback((prev) => ({ ...prev, [id]: message }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (expandedId === id) setExpandedId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function projectBadge(project: ProjectListItem): {
    label: string;
    dot: string;
    text: string;
  } {
    if (!connection.connected)
      return {
        label: "Sem conexão",
        dot: "bg-status-overdue",
        text: "text-status-overdue",
      };
    if (!project.lastPolledAt)
      return {
        label: "Nunca sincronizado",
        dot: "bg-accent-secondary",
        text: "text-accent-secondary",
      };
    return {
      label: "Conectado",
      dot: "bg-status-done",
      text: "text-status-done",
    };
  }

  return (
    <CardShell
      title={
        <span className="flex items-center gap-2.5">
          Projetos
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground-primary">
            {projects.length}
          </span>
        </span>
      }
    >
      <div className="flex flex-col">
        {projects.length === 0 && (
          <p className="px-6 py-5 text-sm text-foreground-muted">
            Nenhum projeto ainda. Adicione um repositório abaixo.
          </p>
        )}

        {projects.map((project) => {
          const expanded = expandedId === project.id;
          const conn = projectBadge(project);
          const state = activity[project.id];
          const busy = busyId === project.id;
          return (
            <div
              key={project.id}
              className="flex flex-col border-b border-border-subtle"
            >
              <div className="flex items-center justify-between gap-3 px-6 py-3.5">
                <button
                  type="button"
                  data-testid="project-row"
                  onClick={() => toggleExpand(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5 shrink-0 text-foreground-muted" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-foreground-muted" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold text-foreground-primary">
                      {project.name}
                    </span>
                    <span className="truncate font-mono text-[11px] text-foreground-muted">
                      {project.owner}/{project.repo}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${conn.dot}`} />
                    <span
                      className={`font-body text-[11px] font-medium ${conn.text}`}
                    >
                      {conn.label}
                    </span>
                  </span>
                  <button
                    type="button"
                    data-testid="sync-now"
                    onClick={() => handleSync(project.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-sm border border-border-subtle px-3 py-1.5 text-[12px] font-medium text-foreground-primary transition-colors hover:bg-surface-elevated disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Sincronizar Agora
                  </button>
                  <button
                    type="button"
                    aria-label={`Remover ${project.name}`}
                    onClick={() => handleDelete(project.id)}
                    disabled={busy}
                    className="text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </div>

              {feedback[project.id] && (
                <p className="px-6 pb-3 text-[12px] text-foreground-muted">
                  {feedback[project.id]}
                </p>
              )}

              {expanded && (
                <div className="flex flex-col gap-4 bg-surface-primary px-6 py-4">
                  {(!state || state.phase === "loading") && (
                    <span className="flex items-center gap-2 text-[12px] text-foreground-muted">
                      <Loader2 className="size-3.5 animate-spin" /> Carregando
                      atividade…
                    </span>
                  )}
                  {state?.phase === "error" && (
                    <span className="text-[12px] text-status-overdue">
                      Falha ao carregar a atividade.
                    </span>
                  )}
                  {state?.phase === "ready" && (
                    <ActivityLog data={state.data} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-col gap-3 px-6 py-5"
        aria-label="Adicionar projeto"
      >
        <span className="font-body text-xs font-medium text-foreground-primary">
          Adicionar projeto
        </span>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (opcional)"
            className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
          <input
            data-testid="add-project-owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
          <input
            data-testid="add-project-repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="Repositório"
            className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
        </div>
        {addError && (
          <span className="text-[12px] text-status-overdue">{addError}</span>
        )}
        <button
          type="submit"
          disabled={adding}
          className="flex items-center gap-1.5 self-start rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {adding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Adicionar Projeto
        </button>
      </form>
    </CardShell>
  );
}

function ActivityLog({ data }: { data: Activity }) {
  const lastRun = data.workflowRuns[0];
  return (
    <>
      <section className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          <GitCommit className="size-3.5" /> Commits recentes
        </span>
        {data.commits.length === 0 ? (
          <span className="text-[12px] text-foreground-muted">
            Nenhum commit sincronizado.
          </span>
        ) : (
          data.commits.map((commit) => (
            <div
              key={commit.sha}
              data-testid="commit-row"
              className="flex items-baseline gap-2.5"
            >
              <span className="font-mono text-[11px] text-accent-primary">
                {shortSha(commit.sha)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground-primary">
                {commit.message}
              </span>
              <span className="shrink-0 font-body text-[11px] text-foreground-muted">
                {commit.author} · {timeAgo(commit.committedAt)}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <span className="flex items-center gap-2 font-body text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          <GitBranch className="size-3.5" /> Branches
        </span>
        <div className="flex flex-wrap gap-2">
          {data.branches.length === 0 ? (
            <span className="text-[12px] text-foreground-muted">
              Nenhuma branch.
            </span>
          ) : (
            data.branches.map((branch) => (
              <span
                key={branch.name}
                data-testid="branch-row"
                className="flex items-center gap-1.5 rounded-sm border border-border-subtle px-2.5 py-1 font-mono text-[11px] text-foreground-primary"
              >
                {branch.name}
                {branch.isDefault && (
                  <span className="rounded-full bg-accent-primary/10 px-1.5 text-[10px] font-semibold text-accent-primary">
                    default
                  </span>
                )}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="flex items-center gap-2">
        <span className="font-body text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          Último CI
        </span>
        {lastRun ? (
          <RunBadge run={lastRun} />
        ) : (
          <span className="text-[12px] text-foreground-muted">
            Sem workflow runs.
          </span>
        )}
      </section>
    </>
  );
}

function RunBadge({ run }: { run: ActivityRun }) {
  const status = deriveRunStatus({
    status: run.status,
    conclusion: run.conclusion,
  });
  const badge = RUN_BADGE[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-medium ${badge.className}`}
    >
      {run.name}: {badge.label}
    </span>
  );
}
