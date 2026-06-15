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

export const metadata: Metadata = {
  title: "Configurações — GuiaGoals",
};

export default function ConfiguracoesPage() {
  return (
    <>
      <AppHeader title="Configurações" breadcrumb="Dashboard / Configurações" />
      <div className="flex flex-1 gap-6 px-8 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <ProfileCard />
          <ProjectCard />
          <PasswordCard />
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
