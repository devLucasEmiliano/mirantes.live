import { LogIn } from "lucide-react";
import Link from "next/link";
import { LiveTag } from "./live-tag";
import { ProjectSwitcher } from "./project-switcher";

interface PublicHeaderProps {
  projectName: string;
  tagline: string;
  /** Mostra o selo AO VIVO quando o snapshot está no ar. */
  live: boolean;
  /** ISO 8601 do snapshot; renderizado como horário local (oculto se for o fallback). */
  updatedAt: string;
}

/** Cabeçalho da home pública — alimentado pelo snapshot do Redis (SPEC §1/§4). */
export function PublicHeader({
  projectName,
  tagline,
  live,
  updatedAt,
}: PublicHeaderProps) {
  const updatedLabel = formatUpdatedAt(updatedAt);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-card px-10">
      <div className="flex items-center gap-3">
        <span className="font-display text-[22px] font-bold text-foreground-primary">
          {projectName}
        </span>
        <span className="h-6 w-px bg-border-subtle" />
        <span className="font-body text-xs text-foreground-muted">
          {tagline}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProjectSwitcher projectName={projectName} />
        {live && <LiveTag />}
        {updatedLabel && (
          <span className="font-body text-[11px] text-foreground-muted">
            {updatedLabel}
          </span>
        )}
        <Link
          href="/login"
          aria-label="Entrar"
          className="text-foreground-muted transition-colors hover:text-foreground-primary"
        >
          <LogIn className="size-5" />
        </Link>
      </div>
    </header>
  );
}

/** Formata o timestamp; devolve null para o fallback (epoch) — aí nada é exibido. */
function formatUpdatedAt(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return null;
  return `Atualizado ${date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  })}`;
}
