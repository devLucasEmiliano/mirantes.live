"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommit,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";
import { GithubMark } from "@/components/integracoes/github-mark";
import {
  deriveRunStatus,
  isValidRepoSlug,
  type RunStatus,
} from "@/lib/github/map";
import type { UserRepo } from "@/lib/github/repos";

// Gerência de projetos (spec 008 → 009, em Integrações). Lista, adiciona, remove,
// sincroniza e, ao expandir, mostra o log de atividade (commits/branches/último run).
// Fala SÓ com a API via fetch (nada de Prisma/segredo aqui); o gate de auth (admin+
// cliente) é da página. Cada usuário gere os SEUS projetos. Após cada mutação chama
// router.refresh() (re-renderiza o Server Component).
//
// Visual: segue o desenho `Yh9ef` (desing.pen) — cabeçalho com badge de conexão, projeto
// expandido ganha barra accent (marrom) + painel de detalhe, linha recolhida discreta.

export interface ProjectListItem {
  id: string;
  name: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  /** ISO 8601 ou null — usado p/ o badge de conexão. */
  lastPolledAt: string | null;
  /** Visível na home pública `/` (spec 016). */
  isPublic: boolean;
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

type RepoPickerState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; repos: UserRepo[] };

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

/** Badge de conexão por projeto: cor do token + um hex "claro" para uso sobre a barra accent. */
interface ProjectBadge {
  label: string;
  dot: string;
  text: string;
  bg: string;
  dotLight: string;
}

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

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Edição (spec 016): nome + flag "Público" por projeto, salvos via PATCH. Estado por id,
  // semeado a partir dos `projects` (Server Component) sempre que a lista muda.
  const [edits, setEdits] = useState<
    Record<string, { name: string; isPublic: boolean }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  useEffect(() => {
    setEdits(
      Object.fromEntries(
        projects.map((p) => [p.id, { name: p.name, isPublic: p.isPublic }]),
      ),
    );
  }, [projects]);

  // Seletor de repositórios (spec 010): carrega os repos da conta conectada e filtra os já
  // adicionados (via `projects`). A entrada manual segue como fallback.
  const [repoState, setRepoState] = useState<RepoPickerState>(() =>
    connection.connected ? { phase: "loading" } : { phase: "idle" },
  );
  const [query, setQuery] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [addingRepo, setAddingRepo] = useState<string | null>(null);

  useEffect(() => {
    if (!connection.connected) return;
    let cancelled = false;
    setRepoState({ phase: "loading" });
    fetch("/api/github/repos")
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<{ repos: UserRepo[] }>;
      })
      .then((json) => {
        if (!cancelled) setRepoState({ phase: "ready", repos: json.repos });
      })
      .catch(() => {
        if (!cancelled) setRepoState({ phase: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [connection.connected]);

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
        body: JSON.stringify({ owner: owner.trim(), repo: repo.trim() }),
      });
      if (res.ok) {
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

  // Adiciona um projeto a partir de uma escolha do seletor (nome = repo, pelo servidor).
  async function addRepo(repoOwner: string, repoName: string) {
    setAddError(null);
    setAddingRepo(`${repoOwner}/${repoName}`);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repoOwner, repo: repoName }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setAddError(
        res.status === 409 || json?.error === "already_exists"
          ? "Esse repositório já está cadastrado."
          : "Não foi possível adicionar o projeto.",
      );
    } finally {
      setAddingRepo(null);
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

  // Salva nome + "Público" (spec 016) via PATCH escopado; depois re-renderiza o Server Component.
  async function handleSaveSettings(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setSavingId(id);
    setFeedback((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name.trim(),
          isPublic: edit.isPublic,
        }),
      });
      if (res.ok) {
        setFeedback((prev) => ({ ...prev, [id]: "Alterações salvas." }));
        router.refresh();
        return;
      }
      setFeedback((prev) => ({
        ...prev,
        [id]:
          res.status === 404
            ? "Projeto não encontrado."
            : "Não foi possível salvar as alterações.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  function projectBadge(project: ProjectListItem): ProjectBadge {
    if (!connection.connected)
      return {
        label: "Sem conexão",
        dot: "bg-status-overdue",
        text: "text-status-overdue",
        bg: "bg-status-overdue/10",
        dotLight: "#FCA5A5",
      };
    if (!project.lastPolledAt)
      return {
        label: "Nunca sincronizado",
        dot: "bg-accent-secondary",
        text: "text-accent-secondary",
        bg: "bg-accent-secondary/15",
        dotLight: "#E9C8A8",
      };
    return {
      label: "Conectado",
      dot: "bg-status-done",
      text: "text-status-done",
      bg: "bg-status-done/10",
      dotLight: "#4ADE80",
    };
  }

  const cardConn = connection.connected
    ? {
        label: "Conectado",
        dot: "bg-status-done",
        text: "text-status-done",
        bg: "bg-status-done/10",
      }
    : {
        label: "Sem conexão",
        dot: "bg-status-overdue",
        text: "text-status-overdue",
        bg: "bg-status-overdue/10",
      };

  // Repos do seletor: tira os já adicionados (compara owner/repo) e aplica a busca.
  const addedSlugs = new Set(
    projects.map((p) => `${p.owner}/${p.repo}`.toLowerCase()),
  );
  const visibleRepos =
    repoState.phase === "ready"
      ? repoState.repos.filter(
          (r) =>
            !addedSlugs.has(r.fullName.toLowerCase()) &&
            r.fullName.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : [];

  // Entrada manual (fallback): owner/repo, sem Nome (nome = repo no servidor).
  const manualForm = (
    <form
      onSubmit={handleAdd}
      className="flex flex-col gap-3"
      aria-label="Adicionar projeto manualmente"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
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
  );

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
      headerExtra={
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${cardConn.bg}`}
        >
          <span className={`size-1.5 rounded-full ${cardConn.dot}`} />
          <span className={`text-[11px] font-medium ${cardConn.text}`}>
            {cardConn.label}
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
              className="flex flex-col border-b border-border-subtle last:border-b-0"
            >
              <div
                className={`flex items-center justify-between gap-3 px-6 py-3.5 transition-colors ${
                  expanded ? "bg-accent-primary" : "hover:bg-surface-elevated"
                }`}
              >
                <button
                  type="button"
                  data-testid="project-row"
                  onClick={() => toggleExpand(project.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5 shrink-0 text-foreground-inverse" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-foreground-muted" />
                  )}
                  <GithubMark
                    className={`size-4 shrink-0 ${
                      expanded
                        ? "text-foreground-inverse"
                        : "text-foreground-muted"
                    }`}
                  />
                  <span
                    className={`truncate text-sm font-semibold ${
                      expanded
                        ? "text-foreground-inverse"
                        : "text-foreground-primary"
                    }`}
                  >
                    {project.owner}/{project.repo}
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-3">
                  {expanded ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: conn.dotLight }}
                      />
                      <span className="text-[11px] font-medium text-foreground-inverse">
                        {conn.label}
                      </span>
                    </span>
                  ) : (
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${conn.bg}`}
                    >
                      <span className={`size-1.5 rounded-full ${conn.dot}`} />
                      <span className={`text-[11px] font-medium ${conn.text}`}>
                        {conn.label}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid="sync-now"
                    onClick={() => handleSync(project.id)}
                    disabled={busy}
                    className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                      expanded
                        ? "border-white/30 text-foreground-inverse hover:bg-white/10"
                        : "border-border-subtle text-foreground-primary hover:bg-surface-elevated"
                    }`}
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
                    className={`transition-colors disabled:opacity-50 ${
                      expanded
                        ? "text-foreground-inverse/70 hover:text-foreground-inverse"
                        : "text-foreground-muted hover:text-status-overdue"
                    }`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </span>
              </div>

              {feedback[project.id] && (
                <p className="px-6 pb-3 pt-2 text-[12px] text-foreground-muted">
                  {feedback[project.id]}
                </p>
              )}

              {expanded && (
                <div className="flex flex-col gap-5 px-6 py-5">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-body text-xs font-medium text-foreground-primary">
                      Repositório GitHub
                    </span>
                    <span className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 font-mono text-[13px] text-foreground-primary">
                      <GithubMark className="size-4 shrink-0 text-foreground-muted" />
                      {project.owner}/{project.repo}
                    </span>
                  </div>

                  <ProjectSettings
                    edit={
                      edits[project.id] ?? {
                        name: project.name,
                        isPublic: project.isPublic,
                      }
                    }
                    saving={savingId === project.id}
                    onChange={(patch) =>
                      setEdits((prev) => ({
                        ...prev,
                        [project.id]: {
                          ...(prev[project.id] ?? {
                            name: project.name,
                            isPublic: project.isPublic,
                          }),
                          ...patch,
                        },
                      }))
                    }
                    onSave={() => handleSaveSettings(project.id)}
                  />

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

      <div className="flex flex-col gap-3 border-t border-border-subtle px-6 py-5">
        <span className="flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          <Plus className="size-3.5 text-accent-primary" />
          Adicionar projeto
        </span>

        {connection.connected && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-foreground-muted" />
              <input
                data-testid="add-project-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque um repositório do seu GitHub…"
                className="w-full rounded-sm border border-border-subtle bg-surface-primary py-2.5 pr-3.5 pl-9 text-sm text-foreground-primary outline-none focus:border-accent-primary"
              />
            </div>

            {repoState.phase === "loading" && (
              <span className="flex items-center gap-2 px-1 text-[12px] text-foreground-muted">
                <Loader2 className="size-3.5 animate-spin" /> Carregando
                repositórios…
              </span>
            )}
            {repoState.phase === "error" && (
              <span className="px-1 text-[12px] text-status-overdue">
                Não foi possível carregar seus repositórios. Use a entrada
                manual abaixo.
              </span>
            )}
            {repoState.phase === "ready" && (
              <div className="flex max-h-64 flex-col overflow-y-auto rounded-sm border border-border-subtle">
                {visibleRepos.length === 0 ? (
                  <span className="px-3.5 py-3 text-[12px] text-foreground-muted">
                    {repoState.repos.length === 0
                      ? "Nenhum repositório na sua conta do GitHub."
                      : query.trim()
                        ? "Nenhum repositório encontrado."
                        : "Todos os seus repositórios já foram adicionados."}
                  </span>
                ) : (
                  visibleRepos.map((r) => {
                    const busy = addingRepo === r.fullName;
                    return (
                      <button
                        key={r.fullName}
                        type="button"
                        data-testid="add-project-repo-option"
                        data-repo={r.fullName}
                        onClick={() => addRepo(r.owner, r.repo)}
                        disabled={addingRepo !== null}
                        className="flex items-center justify-between gap-2.5 border-b border-border-subtle px-3.5 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-elevated disabled:opacity-50"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <GithubMark className="size-3.5 shrink-0 text-foreground-muted" />
                          <span className="truncate font-mono text-[13px] text-foreground-primary">
                            {r.fullName}
                          </span>
                          {r.private && (
                            <span className="shrink-0 rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">
                              privado
                            </span>
                          )}
                        </span>
                        {busy ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-foreground-muted" />
                        ) : (
                          <Plus className="size-3.5 shrink-0 text-accent-primary" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {connection.connected ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              className="self-start text-[12px] font-medium text-accent-primary hover:underline"
            >
              {showManual ? "Ocultar entrada manual" : "Adicionar manualmente"}
            </button>
            {showManual && manualForm}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-[12px] text-foreground-muted">
              Conecte o GitHub para escolher um repositório, ou adicione
              manualmente:
            </span>
            {manualForm}
          </div>
        )}

        {addError && (
          <span className="text-[12px] text-status-overdue">{addError}</span>
        )}
      </div>
    </CardShell>
  );
}

// Painel de configurações por projeto (spec 016): renomear + alternar "Público". Controlado
// pelo pai (estado em `edits`); salva via PATCH escopado. Sem Prisma/segredo aqui (só fetch).
function ProjectSettings({
  edit,
  saving,
  onChange,
  onSave,
}: {
  edit: { name: string; isPublic: boolean };
  saving: boolean;
  onChange: (patch: Partial<{ name: string; isPublic: boolean }>) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="font-body text-xs font-medium text-foreground-primary">
          Nome do projeto
        </span>
        <input
          data-testid="project-name-input"
          value={edit.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
        />
      </div>

      <button
        type="button"
        data-testid="project-public-toggle"
        role="switch"
        aria-checked={edit.isPublic}
        onClick={() => onChange({ isPublic: !edit.isPublic })}
        className="flex items-center justify-between gap-3 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm text-foreground-primary">
            <Globe className="size-3.5 text-foreground-muted" /> Público
          </span>
          <span className="text-[11px] text-foreground-muted">
            Aparece na home pública para qualquer visitante.
          </span>
        </span>
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            edit.isPublic ? "bg-status-done" : "bg-surface-elevated"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
              edit.isPublic ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>

      <button
        type="button"
        data-testid="project-save"
        onClick={onSave}
        disabled={saving || edit.name.trim().length === 0}
        className="flex items-center gap-1.5 self-start rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Salvar
      </button>
    </div>
  );
}

function ActivityLog({ data }: { data: Activity }) {
  const lastRun = data.workflowRuns[0];
  // Os commits sincronizados vêm da branch padrão (sync usa `sha: defaultBranch`),
  // então rotulamos cada SHA com ela. Derivada da lista de branches (isDefault).
  const defaultBranch = data.branches.find((b) => b.isDefault)?.name;
  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-sm bg-surface-elevated p-4">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground-primary">
          <GitCommit className="size-3.5 text-accent-primary" /> Último commit
          sincronizado
        </span>
        {data.commits.length === 0 ? (
          <span className="text-[12px] text-foreground-muted">
            Nenhum commit sincronizado.
          </span>
        ) : (
          data.commits.slice(0, 3).map((commit) => (
            <div
              key={commit.sha}
              data-testid="commit-row"
              className="flex flex-col gap-0.5"
            >
              <span className="flex items-center gap-1.5 font-mono text-[12px]">
                <span className="text-accent-primary">
                  {shortSha(commit.sha)}
                </span>
                {defaultBranch && (
                  <span className="flex items-center gap-1 text-foreground-muted">
                    <GitBranch className="size-3" />
                    {defaultBranch}
                  </span>
                )}
              </span>
              <span className="text-[13px] text-foreground-primary">
                {commit.message}
              </span>
              <span className="flex items-center gap-3 font-body text-[11px] text-foreground-muted">
                <span>por {commit.author}</span>
                <span>{timeAgo(commit.committedAt)}</span>
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
