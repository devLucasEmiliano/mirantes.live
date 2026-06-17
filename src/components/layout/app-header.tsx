import { Bell } from "lucide-react";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { listProjects, scopeForUser } from "@/lib/projects";
import {
  pickSelectedProject,
  SELECTED_PROJECT_COOKIE,
} from "@/lib/projects/select";
import { LiveTag } from "./live-tag";
import { ProjectSwitcher } from "./project-switcher";

interface AppHeaderProps {
  title: string;
  breadcrumb: string;
}

// Server Component (async): lista os projetos DO ESCOPO + resolve o selecionado (cookie;
// fallback = mais antigo) e passa ao switcher (client). Cliente vê só os seus; admin todos.
export async function AppHeader({ title, breadcrumb }: AppHeaderProps) {
  const current = await getCurrentUser();
  const scope = current ? scopeForUser(current) : null;
  const projects = scope ? (await listProjects(scope)).projects : [];
  const store = await cookies();
  const selected = pickSelectedProject(
    projects,
    store.get(SELECTED_PROJECT_COOKIE)?.value ?? null,
  );

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
        <ProjectSwitcher
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          selectedId={selected?.id ?? null}
        />
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
