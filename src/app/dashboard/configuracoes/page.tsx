import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/configuracoes/password-form";
import { ProfileForm } from "@/components/configuracoes/profile-form";
import {
  type ProjectListItem,
  ProjectsManager,
} from "@/components/configuracoes/projects-manager";
import {
  DangerZoneCard,
  ProjectSettingsCard,
  ReportsCard,
  UptimeMonitoringCard,
} from "@/components/configuracoes/tools-cards";
import { AppHeader } from "@/components/layout/app-header";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { listProjects } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Configurações — Mirantes.Live",
};

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatMemberSince(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

export default async function ConfiguracoesPage() {
  // Tela exclusiva do admin (PRD §2/§9). Cliente é redirecionado ao dashboard.
  const admin = await requireAdmin();
  const user = await db.user.findUnique({
    where: { id: admin.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      avatar: { select: { updatedAt: true } },
    },
  });
  if (!user) redirect("/login");

  // Lista de projetos (plain) + se há PAT no servidor — passados ao manager client.
  const { projects } = await listProjects();
  const projectItems: ProjectListItem[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    owner: project.owner,
    repo: project.repo,
    defaultBranch: project.defaultBranch,
    lastPolledAt: project.lastPolledAt?.toISOString() ?? null,
  }));
  const hasToken = Boolean(env.GITHUB_PAT);

  return (
    <>
      <AppHeader title="Configurações" breadcrumb="Dashboard / Configurações" />
      <div className="flex flex-1 gap-6 px-8 py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <ProfileForm
            initialName={user.name ?? ""}
            initialEmail={user.email}
            memberSince={formatMemberSince(user.createdAt)}
            initialHasAvatar={user.avatar !== null}
            initialAvatarVersion={user.avatar?.updatedAt.getTime() ?? 0}
          />
          <PasswordForm />
          <ProjectsManager projects={projectItems} hasToken={hasToken} />
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
