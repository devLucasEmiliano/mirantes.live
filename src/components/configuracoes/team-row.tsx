"use client";

import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { SearchPicker } from "@/components/configuracoes/search-picker";
import {
  type FilterableTeam,
  filterProjects,
  filterUsers,
  teamNameOf,
} from "@/lib/teams-filter";

// Uma linha de equipe (spec 023): recolhida = cabeçalho; expandida = membros + projetos, cada
// bloco com um `<SearchPicker>` escondido atrás de um link (a coluna da conta é estreita, picker
// sempre aberto deixaria a equipe alta demais). Só UM picker aberto por vez.
// NÃO faz `fetch`: recebe handlers do `<TeamsManagerCard>` e, quando eles devolvem `true`,
// fecha o picker e limpa a busca (o pai é quem dá `router.refresh()`).

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

/** Extrai o id do item em andamento de um `busyKey` `<prefixo>:<id>`. */
function busyIdFor(busyKey: string | null, prefix: string): string | null {
  const head = `${prefix}:`;
  return busyKey?.startsWith(head) ? busyKey.slice(head.length) : null;
}

export function TeamRow({
  team,
  teams,
  users,
  projects,
  expanded,
  busyKey,
  onToggle,
  onDelete,
  onAddMember,
  onRemoveMember,
  onAssignProject,
  onUnassignProject,
}: {
  team: TeamListItem;
  /** Todas as equipes — resolve o badge "em {equipe}" dos projetos de outra equipe. */
  teams: FilterableTeam[];
  users: AssignableUser[];
  projects: AssignableProject[];
  expanded: boolean;
  busyKey: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onAddMember: (userId: string) => Promise<boolean>;
  onRemoveMember: (userId: string) => void;
  onAssignProject: (projectId: string) => Promise<boolean>;
  onUnassignProject: (projectId: string) => void;
}) {
  const [openPicker, setOpenPicker] = useState<"members" | "projects" | null>(
    null,
  );
  const [memberQuery, setMemberQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");

  const memberIds = team.members.map((m) => m.userId);
  const userOptions = filterUsers(users, memberIds, memberQuery);
  const projectOptions = filterProjects(projects, team.id, projectQuery);

  function togglePicker(picker: "members" | "projects") {
    setOpenPicker((cur) => (cur === picker ? null : picker));
  }

  async function pickMember(user: AssignableUser) {
    const ok = await onAddMember(user.id);
    if (!ok) return;
    setOpenPicker(null);
    setMemberQuery("");
  }

  async function pickProject(project: AssignableProject) {
    const ok = await onAssignProject(project.id);
    if (!ok) return;
    setOpenPicker(null);
    setProjectQuery("");
  }

  return (
    <div
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
          onClick={onToggle}
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
            className={`shrink-0 text-[11px] ${expanded ? "text-foreground-inverse/70" : "text-foreground-muted"}`}
          >
            {team.members.length} membro(s) · {team.projects.length} projeto(s)
          </span>
        </button>
        <button
          type="button"
          aria-label={`Excluir ${team.name}`}
          onClick={onDelete}
          disabled={busyKey === `team:${team.id}`}
          className={`transition-colors disabled:opacity-50 ${
            expanded
              ? "text-foreground-inverse/70 hover:text-foreground-inverse"
              : "text-foreground-muted hover:text-status-overdue"
          }`}
        >
          {busyKey === `team:${team.id}` ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
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
                      onClick={() => onRemoveMember(member.userId)}
                      disabled={busyKey === `member:${member.userId}`}
                      className="shrink-0 text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                    >
                      {busyKey === `member:${member.userId}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              data-testid="team-member-picker-open"
              onClick={() => togglePicker("members")}
              className="self-start text-[12px] font-medium text-accent-primary hover:underline"
            >
              {openPicker === "members" ? "Cancelar" : "+ Adicionar membro"}
            </button>
            {openPicker === "members" && (
              <SearchPicker
                items={userOptions}
                query={memberQuery}
                onQueryChange={setMemberQuery}
                keyOf={(user) => user.id}
                onPick={pickMember}
                placeholder="Busque por nome ou email…"
                emptyLabel="Todos os usuários já são membros."
                noResultsLabel="Nenhum usuário encontrado."
                busyKey={busyIdFor(busyKey, "member")}
                testId="team-member"
                itemIdAttr="data-user-id"
                renderItem={(user) => (
                  <span className="flex min-w-0 items-center gap-2">
                    <User className="size-3.5 shrink-0 text-foreground-muted" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[13px] text-foreground-primary">
                        {user.name ?? user.email}
                      </span>
                      {user.name && (
                        <span className="truncate text-[11px] text-foreground-muted">
                          {user.email}
                        </span>
                      )}
                    </span>
                  </span>
                )}
              />
            )}
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
                      onClick={() => onUnassignProject(project.id)}
                      disabled={busyKey === `project:${project.id}`}
                      className="shrink-0 text-foreground-muted transition-colors hover:text-status-overdue disabled:opacity-50"
                    >
                      {busyKey === `project:${project.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              data-testid="team-project-picker-open"
              onClick={() => togglePicker("projects")}
              className="self-start text-[12px] font-medium text-accent-primary hover:underline"
            >
              {openPicker === "projects" ? "Cancelar" : "+ Atribuir projeto"}
            </button>
            {openPicker === "projects" && (
              <SearchPicker
                items={projectOptions}
                query={projectQuery}
                onQueryChange={setProjectQuery}
                keyOf={(project) => project.id}
                onPick={pickProject}
                placeholder="Busque por owner/repo…"
                emptyLabel="Todos os projetos já estão nesta equipe."
                noResultsLabel="Nenhum projeto encontrado."
                busyKey={busyIdFor(busyKey, "project")}
                testId="team-project"
                itemIdAttr="data-project-id"
                renderItem={(project) => {
                  const otherTeam = teamNameOf(project.teamId, teams);
                  return (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-mono text-[13px] text-foreground-primary">
                        {project.owner}/{project.repo}
                      </span>
                      {otherTeam && (
                        <span className="shrink-0 rounded-full bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">
                          em {otherTeam}
                        </span>
                      )}
                    </span>
                  );
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
