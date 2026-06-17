import { Bell } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LiveTag } from "./live-tag";
import { ProjectSwitcher } from "./project-switcher";

interface AppHeaderProps {
  title: string;
  breadcrumb: string;
}

// Server Component (async): busca o nome do projeto raiz (o mais antigo) DO ESCOPO e
// passa ao switcher — cliente vê só os seus; admin, o mais antigo global (spec 009).
export async function AppHeader({ title, breadcrumb }: AppHeaderProps) {
  const current = await getCurrentUser();
  const project = await db.project.findFirst({
    where: current?.role === "client" ? { userId: current.id } : {},
    orderBy: { createdAt: "asc" },
    select: { name: true },
  });

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
        <ProjectSwitcher projectName={project?.name ?? null} />
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
