"use client";

import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { selectPublicProject } from "@/lib/projects/public-actions";
import { cn } from "@/lib/utils";

// Seletor de projetos PÚBLICOS da home `/` (spec 016). Cada item é um <Link> p/
// `/?projeto=owner/repo` — link COMPARTILHÁVEL e a fonte de verdade da seleção (server re-render
// pelo searchParam). O clique também dispara `selectPublicProject` (cookie de MEMÓRIA, não-crítico).
// Sem públicos → botão inerte "Nenhum projeto público". Espelha `project-switcher` (header logado).

export interface PublicSwitcherItem {
  id: string;
  name: string;
  /** `owner/repo` — vai na URL `?projeto=`. */
  slug: string;
}

export function PublicProjectSwitcher({
  projects,
  selectedId,
}: {
  projects: PublicSwitcherItem[];
  selectedId: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="public-project-switcher"
        onClick={() => setOpen((o) => !o)}
        disabled={projects.length === 0}
        className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-surface-elevated disabled:opacity-60"
      >
        <span className="size-1.5 rounded-full bg-status-done" />
        <span className="font-mono text-[11px] text-foreground-muted">
          {selected?.name ?? "Nenhum projeto público"}
        </span>
        <ChevronsUpDown className="size-3 text-foreground-muted" />
      </button>

      {open && projects.length > 0 && (
        <div className="absolute right-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-sm border border-border-subtle bg-surface-card py-1 shadow-lg">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/?projeto=${encodeURIComponent(project.slug)}`}
              data-testid="public-project-option"
              onClick={() => {
                setOpen(false);
                void selectPublicProject(project.id);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors hover:bg-surface-elevated",
                project.id === selected?.id
                  ? "text-foreground-primary"
                  : "text-foreground-muted",
              )}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  project.id === selected?.id
                    ? "bg-status-done"
                    : "bg-border-subtle",
                )}
              />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
