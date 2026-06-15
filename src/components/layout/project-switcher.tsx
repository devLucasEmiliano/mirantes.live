import { ChevronsUpDown } from "lucide-react";
import { mockProject } from "@/lib/mock-data";

export function ProjectSwitcher() {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-surface-elevated"
    >
      <span className="size-1.5 rounded-full bg-status-done" />
      <span className="font-mono text-[11px] text-foreground-muted">
        {mockProject.name}
      </span>
      <ChevronsUpDown className="size-3 text-foreground-muted" />
    </button>
  );
}
