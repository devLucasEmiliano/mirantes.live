import { LogIn } from "lucide-react";
import Link from "next/link";
import { LiveTag } from "./live-tag";
import { ProjectSwitcher } from "./project-switcher";

export function PublicHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-card px-10">
      <div className="flex items-center gap-3">
        <span className="font-display text-[22px] font-bold text-foreground-primary">
          GuiaGoals
        </span>
        <span className="h-6 w-px bg-border-subtle" />
        <span className="font-body text-xs text-foreground-muted">
          Home / Visão Geral
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProjectSwitcher />
        <LiveTag />
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
