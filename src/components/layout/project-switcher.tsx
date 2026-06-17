"use client";

import { ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { selectProject } from "@/lib/projects/actions";
import { cn } from "@/lib/utils";

// Seletor de projeto do header (client). Dropdown com os projetos do escopo; ao escolher chama
// a Server Action `selectProject` (grava o cookie) + `router.refresh()` p/ o servidor re-renderizar
// dashboard/timeline filtrados. Sem projetos → "Nenhum projeto" (botão inerte).
export function ProjectSwitcher({
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
      await selectProject(id);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="project-switcher"
        onClick={() => setOpen((o) => !o)}
        disabled={pending || projects.length === 0}
        className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-surface-elevated disabled:opacity-60"
      >
        <span className="size-1.5 rounded-full bg-status-done" />
        <span className="font-mono text-[11px] text-foreground-muted">
          {selected?.name ?? "Nenhum projeto"}
        </span>
        <ChevronsUpDown className="size-3 text-foreground-muted" />
      </button>

      {open && projects.length > 0 && (
        <div className="absolute right-0 z-20 mt-1 min-w-[200px] overflow-hidden rounded-sm border border-border-subtle bg-surface-card py-1 shadow-lg">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              data-testid="project-option"
              onClick={() => choose(project.id)}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
