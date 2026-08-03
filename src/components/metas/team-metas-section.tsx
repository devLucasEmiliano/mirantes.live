"use client";

import { ChevronsUpDown, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MetasView } from "@/components/metas/metas-view";
import { selectMetasTeamProject } from "@/lib/goals/team-actions";
import type { Goal } from "@/lib/types";
import { cn } from "@/lib/utils";

// Seção "Metas de equipe" (spec 022): independente do fluxo de metas PRÓPRIAS acima —
// seletor de projeto próprio (não usa o cookie/seletor do header) + árvore SEMPRE read-only
// (`canMutate` fixo em `false`, não depende do papel de quem está vendo — leitura de equipe
// nunca muta). Some por completo se o usuário não participa de nenhuma equipe.
export function TeamMetasSection({
  teamProjects,
  selectedProjectId,
  goals,
}: {
  teamProjects: { id: string; name: string }[];
  selectedProjectId: string | null | undefined;
  goals: Goal[];
}) {
  if (teamProjects.length === 0) return null;

  return (
    <div
      data-testid="team-metas-section"
      className="flex flex-col gap-3 px-8 pb-8"
    >
      <div className="flex items-center gap-2.5">
        <Users className="size-4 text-foreground-muted" />
        <h2 className="font-display text-sm font-bold text-foreground-primary">
          Metas de equipe
        </h2>
        <TeamProjectSwitcher
          projects={teamProjects}
          selectedId={selectedProjectId ?? null}
        />
      </div>
      <div className="rounded-sm bg-surface-card">
        <MetasView goals={goals} canMutate={false} />
      </div>
    </div>
  );
}

function TeamProjectSwitcher({
  projects,
  selectedId,
}: {
  projects: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected =
    projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function choose(id: string) {
    setOpen(false);
    if (id === selected?.id) return;
    startTransition(async () => {
      await selectMetasTeamProject(id);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="team-project-switcher"
        onClick={() => setOpen((o) => !o)}
        disabled={pending || projects.length === 0}
        className="flex items-center gap-1.5 rounded-sm border border-border-subtle bg-surface-card px-2.5 py-1 transition-colors hover:bg-surface-elevated disabled:opacity-60"
      >
        <span className="font-mono text-[11px] text-foreground-primary">
          {selected?.name ?? "Nenhum projeto"}
        </span>
        <ChevronsUpDown className="size-3 text-foreground-muted" />
      </button>

      {open && projects.length > 0 && (
        <div className="absolute left-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-sm border border-border-subtle bg-surface-card py-1 shadow-lg">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              data-testid="team-project-option"
              onClick={() => choose(project.id)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors hover:bg-surface-elevated",
                project.id === selected?.id
                  ? "text-foreground-primary"
                  : "text-foreground-muted",
              )}
            >
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
