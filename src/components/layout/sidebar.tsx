"use client";

import {
  Activity,
  Clock3,
  LayoutDashboard,
  Settings,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mockUser } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Visão Geral", href: "/dashboard", icon: LayoutDashboard },
  { label: "Metas", href: "/dashboard/metas", icon: Target },
  { label: "Timeline", href: "/dashboard/timeline", icon: Clock3 },
  { label: "Monitoramento", href: "/dashboard/monitoramento", icon: Activity },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-surface-inverse px-4 py-6">
      <div className="flex justify-center pb-5">
        <span className="font-display text-lg font-bold text-foreground-inverse">
          GuiaGoals
        </span>
      </div>

      <nav className="flex flex-col gap-0.5">
        <span className="px-3 pb-2 font-body text-[11px] font-medium tracking-[1.2px] text-foreground-muted">
          MENU
        </span>
        {NAV_ITEMS.map((item) => {
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
        <div className="flex size-8 items-center justify-center rounded-full bg-accent-secondary">
          <span className="text-[13px] font-semibold text-foreground-inverse">
            {mockUser.initials}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-foreground-inverse">
            {mockUser.name}
          </span>
          <span className="font-body text-[11px] text-foreground-muted">
            {mockUser.role}
          </span>
        </div>
      </div>
    </aside>
  );
}
