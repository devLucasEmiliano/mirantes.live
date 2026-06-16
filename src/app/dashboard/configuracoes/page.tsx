import type { Metadata } from "next";
import {
  PasswordCard,
  ProfileCard,
  ProjectCard,
} from "@/components/configuracoes/profile-cards";
import {
  DangerZoneCard,
  ProjectSettingsCard,
  ReportsCard,
  UptimeMonitoringCard,
} from "@/components/configuracoes/tools-cards";
import { AppHeader } from "@/components/layout/app-header";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Configurações — Mirantes.Live",
};

export default async function ConfiguracoesPage() {
  // Tela exclusiva do admin (PRD §2/§9). Cliente é redirecionado ao dashboard.
  await requireAdmin();

  return (
    <>
      <AppHeader title="Configurações" breadcrumb="Dashboard / Configurações" />
      <div className="flex flex-1 gap-6 px-8 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <ProfileCard />
          <PasswordCard />
          <ProjectCard />
        </div>
        <div className="flex w-[380px] shrink-0 flex-col gap-5">
          <ReportsCard />
          <UptimeMonitoringCard />
          <ProjectSettingsCard />
          <DangerZoneCard />
        </div>
      </div>
    </>
  );
}
