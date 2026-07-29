"use client";

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";

// Gestão de Equipes (spec 022), admin-only, dentro de Configurações. Card funcional próprio
// (não é um módulo novo no menu — decisão do humano registrada na spec). Lista equipes,
// expande UMA por vez p/ mostrar membros + projetos, com formulários de criar/adicionar/
// remover. Fala SÓ com a API via fetch (sem Prisma/segredo aqui); o gate de auth é da página.
// Após cada mutação chama router.refresh() (re-renderiza o Server Component).

export interface TeamListItem {
  id: string;
  name: string;
  members: { userId: string; email: string; name: string | null }[];
  projects: { id: string; name: string; owner: string; repo: string }[];
}

export interface AssignableUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AssignableProject {
  id: string;
  name: string;
  owner: string;
  repo: string;
  teamId: string | null;
}

export function TeamsManagerCard({
  teams,
  users,
  projects,
}: {
  teams: TeamListItem[];
  users: AssignableUser[];
  projects: AssignableProject[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<Record<string, string>>(
    {},
  );
  const [selectedProjectId, setSelectedProjectId] = useState<
    Record<string, string>
  >({});

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  async function handleCreateTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!newTeamName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      if (res.ok) {
        setNewTeamName("");
        router.refresh();
        return;
      }
      setError("Não foi possível criar a equipe.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTeam(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/teams/${id}`, { method: "DELETE" });
      if (expandedId === id) setExpandedId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(teamId: string) {
    const userId = selectedUserId[teamId];
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError("Não foi possível adicionar o membro.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignProject(teamId: string) {
    const projectId = selectedProjectId[teamId];
    if (!projectId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError("Não foi possível atribuir o projeto.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassignProject(teamId: string, projectId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      title={
        <span className="flex items-center gap-2.5">
          Equipes
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground-primary">
            {teams.length}
          </span>
        </span>
      }
    >
      <div className="flex flex-col">
        {teams.length === 0 && (
          <p className="px-6 py-5 text-sm text-foreground-muted">
            Nenhuma equipe ainda. Crie uma abaixo.
          </p>
        )}

        {teams.map((team) => {
          const expanded = expandedId === team.id;
          const availableUsers = users.filter(
            (u) => !team.members.some((m) => m.userId === u.id),
          );
          const availableProjects = projects.filter(
            (p) => p.teamId !== team.id,
          );
          return (
            <div
              key={team.id}
              data-testid="team-row"
              className="flex flex-col border-b border-border-subtle last:border-b-0"
            >
              <div
                className={`flex items-center justify-between gap-3 px-6 py-3.5 transition-colors ${
                  expanded ? "bg-accent-primary" : "hover:bg-surface-elevated"
                }`}
              >
                <button
                  type="button"
                  data-testid="team-row-toggle"
                  onClick={() => toggleExpand(team.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {expanded ? (
                    <ChevronDown className="size-3.5 shrink-0 text-foreground-inverse" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-foreground-muted" />
                  )}
                  <Users
                    className={`size-4 shrink-0 ${expanded ? "text-foreground-inverse" : "text-foreground-muted"}`}
                  />
                  <span
                    className={`truncate text-sm font-semibold ${expanded ? "text-foreground-inverse" : "text-foreground-primary"}`}
                  >
                    {team.name}
                  </span>
                  <span
                    className={`text-[11px] ${expanded ? "text-foreground-inverse/70" : "text-foreground-muted"}`}
                  >
                    {team.members.length} membro(s) · {team.projects.length}{" "}
                    projeto(s)
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${team.name}`}
                  onClick={() => handleDeleteTeam(team.id)}
                  disabled={busy}
                  className={`transition-colors disabled:opacity-50 ${
                    expanded
                      ? "text-foreground-inverse/70 hover:text-foreground-inverse"
                      : "text-foreground-muted hover:text-status-overdue"
                  }`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {expanded && (
                <div className="flex flex-col gap-5 px-6 py-5">
                  <div className="flex flex-col gap-2">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      Membros
                    </span>
                    {team.members.length === 0 ? (
                      <span className="text-[12px] text-foreground-muted">
                        Nenhum membro ainda.
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {team.members.map((member) => (
                          <li
                            key={member.userId}
                            data-testid="team-member-row"
                            className="flex items-center justify-between gap-2 rounded-sm border border-border-subtle px-3 py-2 text-[13px]"
                          >
                            <span className="truncate text-foreground-primary">
                              {member.name ?? member.email}
                            </span>
                            <button
                              type="button"
                              data-testid="team-member-remove"
                              aria-label={`Remover ${member.email}`}
                              onClick={() =>
                                handleRemoveMember(team.id, member.userId)
                              }
                              disabled={busy}
                              className="text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2">
                      <select
                        data-testid="team-member-select"
                        value={selectedUserId[team.id] ?? ""}
                        onChange={(e) =>
                          setSelectedUserId((prev) => ({
                            ...prev,
                            [team.id]: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3 py-2 text-[13px] text-foreground-primary outline-none focus:border-accent-primary"
                      >
                        <option value="">Selecione um usuário…</option>
                        {availableUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="team-member-add"
                        onClick={() => handleAddMember(team.id)}
                        disabled={busy || !selectedUserId[team.id]}
                        className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-3 py-2 text-[12px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <Plus className="size-3.5" />
                        Adicionar
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="font-body text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                      Projetos
                    </span>
                    {team.projects.length === 0 ? (
                      <span className="text-[12px] text-foreground-muted">
                        Nenhum projeto atribuído ainda.
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {team.projects.map((project) => (
                          <li
                            key={project.id}
                            data-testid="team-project-row"
                            className="flex items-center justify-between gap-2 rounded-sm border border-border-subtle px-3 py-2 text-[13px]"
                          >
                            <span className="truncate font-mono text-foreground-primary">
                              {project.owner}/{project.repo}
                            </span>
                            <button
                              type="button"
                              data-testid="team-project-remove"
                              aria-label={`Desatribuir ${project.name}`}
                              onClick={() =>
                                handleUnassignProject(team.id, project.id)
                              }
                              disabled={busy}
                              className="text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2">
                      <select
                        data-testid="team-project-select"
                        value={selectedProjectId[team.id] ?? ""}
                        onChange={(e) =>
                          setSelectedProjectId((prev) => ({
                            ...prev,
                            [team.id]: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3 py-2 text-[13px] text-foreground-primary outline-none focus:border-accent-primary"
                      >
                        <option value="">Selecione um projeto…</option>
                        {availableProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.owner}/{p.repo}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="team-project-add"
                        onClick={() => handleAssignProject(team.id)}
                        disabled={busy || !selectedProjectId[team.id]}
                        className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-3 py-2 text-[12px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        <Plus className="size-3.5" />
                        Atribuir
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form
        onSubmit={handleCreateTeam}
        className="flex flex-col gap-3 border-t border-border-subtle px-6 py-5"
      >
        <span className="flex items-center gap-2 font-body text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          <Plus className="size-3.5 text-accent-primary" />
          Nova equipe
        </span>
        <div className="flex items-center gap-3">
          <input
            data-testid="team-name-input"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nome da equipe"
            className="flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
          <button
            type="submit"
            data-testid="team-create"
            disabled={busy || !newTeamName.trim()}
            className="flex items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Criar equipe
          </button>
        </div>
        {error && (
          <span className="text-[12px] text-status-overdue">{error}</span>
        )}
      </form>
    </CardShell>
  );
}
