"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardShell } from "@/components/configuracoes/profile-cards";
import {
  type AssignableProject,
  type AssignableUser,
  type TeamListItem,
  TeamRow,
} from "@/components/configuracoes/team-row";

// Gestão de Equipes (spec 022), admin-only, dentro de Configurações. Card funcional próprio
// (não é um módulo novo no menu — decisão do humano registrada na spec). Lista equipes,
// expande UMA por vez p/ mostrar membros + projetos, com formulários de criar/adicionar/
// remover. Fala SÓ com a API via fetch (sem Prisma/segredo aqui); o gate de auth é da página.
// Após cada mutação chama router.refresh() (re-renderiza o Server Component).
// Spec 023: a linha da equipe (e os pickers de busca) mora em `<TeamRow>`; aqui ficaram o
// CardShell, o form "Nova equipe", o erro e TODOS os fetch. `busy: boolean` virou
// `busyKey: string | null` (`member:<id>` | `project:<id>` | `team:<id>` | `create`) — só a
// linha clicada mostra Loader2, o resto do card não congela.

export type { AssignableProject, AssignableUser, TeamListItem };

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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  async function handleCreateTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!newTeamName.trim() || busyKey) return;
    setBusyKey("create");
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
      setBusyKey(null);
    }
  }

  async function handleDeleteTeam(id: string) {
    if (busyKey) return;
    setBusyKey(`team:${id}`);
    try {
      await fetch(`/api/teams/${id}`, { method: "DELETE" });
      if (expandedId === id) setExpandedId(null);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAddMember(
    teamId: string,
    userId: string,
  ): Promise<boolean> {
    if (busyKey) return false;
    setBusyKey(`member:${userId}`);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.refresh();
        return true;
      }
      setError("Não foi possível adicionar o membro.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleRemoveMember(teamId: string, userId: string) {
    if (busyKey) return;
    setBusyKey(`member:${userId}`);
    try {
      await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAssignProject(
    teamId: string,
    projectId: string,
  ): Promise<boolean> {
    if (busyKey) return false;
    setBusyKey(`project:${projectId}`);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (res.ok) {
        router.refresh();
        return true;
      }
      setError("Não foi possível atribuir o projeto.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnassignProject(teamId: string, projectId: string) {
    if (busyKey) return;
    setBusyKey(`project:${projectId}`);
    try {
      await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusyKey(null);
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

        {teams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            teams={teams}
            users={users}
            projects={projects}
            expanded={expandedId === team.id}
            busyKey={busyKey}
            onToggle={() => toggleExpand(team.id)}
            onDelete={() => handleDeleteTeam(team.id)}
            onAddMember={(userId) => handleAddMember(team.id, userId)}
            onRemoveMember={(userId) => handleRemoveMember(team.id, userId)}
            onAssignProject={(projectId) =>
              handleAssignProject(team.id, projectId)
            }
            onUnassignProject={(projectId) =>
              handleUnassignProject(team.id, projectId)
            }
          />
        ))}
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
            className="min-w-0 flex-1 rounded-sm border border-border-subtle bg-surface-primary px-3.5 py-2.5 text-sm text-foreground-primary outline-none focus:border-accent-primary"
          />
          <button
            type="submit"
            data-testid="team-create"
            disabled={busyKey !== null || !newTeamName.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-sm bg-accent-primary px-5 py-2.5 text-[13px] font-semibold text-foreground-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busyKey === "create" ? (
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
