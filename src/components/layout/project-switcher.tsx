import { ChevronsUpDown } from "lucide-react";

// Exibe o nome real do projeto raiz (vem por prop do AppHeader, que busca no banco).
// Sem projetos → "Nenhum projeto". Troca de contexto (dropdown) é spec futura.
export function ProjectSwitcher({
  projectName,
}: {
  projectName: string | null;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-surface-elevated"
    >
      <span className="size-1.5 rounded-full bg-status-done" />
      <span className="font-mono text-[11px] text-foreground-muted">
        {projectName ?? "Nenhum projeto"}
      </span>
      <ChevronsUpDown className="size-3 text-foreground-muted" />
    </button>
  );
}
