"use client";

import {
  Activity,
  Clock3,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { deriveInitials } from "@/lib/account/initials";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** DTO do usuário logado (vem do layout, que consulta o DAL). */
  user: {
    email: string;
    role: "admin" | "client";
    name: string | null;
    hasAvatar: boolean;
    avatarVersion: number;
  };
}

const NAV_ITEMS = [
  { label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Metas", href: "/dashboard/metas", icon: Target },
  { label: "Timeline", href: "/dashboard/timeline", icon: Clock3 },
  { label: "Monitoramento", href: "/dashboard/monitoramento", icon: Activity },
  { label: "Integrações", href: "/dashboard/integracoes", icon: Plug },
  {
    label: "Configurações",
    href: "/dashboard/configuracoes",
    icon: Settings,
    adminOnly: true,
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Cliente não vê "Configurações" (PRD §2); o acesso direto à rota é barrado por
  // requireAdmin() na própria página.
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );
  // Identidade do chip: nome real (cai p/ email se ainda não tiver nome). As iniciais
  // espelham o que é exibido — consistente com o card de Perfil.
  const displayName = user.name ?? user.email;
  const initials = deriveInitials(displayName);
  const roleLabel = user.role === "admin" ? "Administrador" : "Cliente";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col bg-surface-inverse px-4 py-6">
      <div className="flex justify-center pb-5">
        <span className="font-display text-lg font-bold text-foreground-inverse">
          Mirantes.Live
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <span className="px-3 pb-2 font-body text-[11px] font-medium tracking-[1.2px] text-foreground-muted">
          MENU
        </span>
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-[#2a2a2a] text-foreground-inverse"
                  : "text-foreground-muted hover:bg-[#2a2a2a]/60 hover:text-foreground-inverse",
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="h-px w-full bg-[#333333]" />

      <div className="flex items-center gap-2.5 pt-4">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-secondary">
          {user.hasAvatar ? (
            // biome-ignore lint/performance/noImgElement: avatar servido por rota autenticada que devolve bytea cru; next/image não se aplica a esse byte-stream dinâmico
            <img
              src={`/api/account/avatar?v=${user.avatarVersion}`}
              alt="Foto de perfil"
              data-testid="sidebar-avatar-image"
              className="size-full object-cover"
            />
          ) : (
            <span
              data-testid="sidebar-avatar-initials"
              className="text-[13px] font-semibold text-foreground-inverse"
            >
              {initials}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-foreground-inverse">
            {displayName}
          </span>
          <span className="font-body text-[11px] text-foreground-muted">
            {roleLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Sair"
          className="ml-auto shrink-0 text-foreground-muted transition-colors hover:text-foreground-inverse disabled:opacity-50"
        >
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </aside>
  );
}
