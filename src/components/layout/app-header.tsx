import { Bell } from "lucide-react";
import { LiveTag } from "./live-tag";
import { ProjectSwitcher } from "./project-switcher";

interface AppHeaderProps {
  title: string;
  breadcrumb: string;
}

export function AppHeader({ title, breadcrumb }: AppHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-card px-8">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-[22px] font-bold text-foreground-primary">
          {title}
        </h1>
        <span className="h-6 w-px bg-border-subtle" />
        <span className="font-body text-xs text-foreground-muted">
          {breadcrumb}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <ProjectSwitcher />
        <LiveTag />
        <button
          type="button"
          aria-label="Notificações"
          className="text-foreground-muted transition-colors hover:text-foreground-primary"
        >
          <Bell className="size-5" />
        </button>
      </div>
    </header>
  );
}
