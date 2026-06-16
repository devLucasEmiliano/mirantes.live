"use client";

import {
  Activity,
  Clock3,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  /** DTO mínimo do usuário logado (vem do layout, que consulta o DAL). */
  user: { email: string; role: "admin" | "client" };
}

const NAV_ITEMS = [
  { label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Metas", href: "/dashboard/metas", icon: Target },
  { label: "Timeline", href: "/dashboard/timeline", icon: Clock3 },
  { label: "Monitoramento", href: "/dashboard/monitoramento", icon: Activity },
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
  const initials = user.email.slice(0, 2).toUpperCase();
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
    <aside className="flex w-60 shrink-0 flex-col bg-surface-inverse px-4 py-6">
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
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-secondary">
          <span className="text-[13px] font-semibold text-foreground-inverse">
            {initials}
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-foreground-inverse">
            {user.email}
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
