import type { Metadata } from "next";
import { GithubConnectionCard } from "@/components/integracoes/github-connection-card";
import {
  McpSetupCard,
  type McpTokenItem,
} from "@/components/integracoes/mcp-setup-card";
import {
  type ProjectListItem,
  ProjectsManager,
} from "@/components/integracoes/projects-manager";
import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { getConnectionStatus } from "@/lib/github/connection";
import { listMcpTokens } from "@/lib/mcp/tokens";
import { listProjects, scopeForUser } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Integrações — Mirantes.Live",
};

// Tela aberta a admin + cliente (spec 009): conecta a conta do GitHub e gere os SEUS
// projetos. Visibilidade escopada por papel (cliente só os seus; admin todos). O gate é
// requireUser() — não requireAdmin (≠ Configurações).
export default async function IntegracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string }>;
}) {
  const user = await requireUser();
  const { github } = await searchParams;

  const status = await getConnectionStatus(user.id);
  const conn = { connected: status.connected, githubLogin: status.githubLogin };

  const { projects } = await listProjects(scopeForUser(user));
  const projectItems: ProjectListItem[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    owner: project.owner,
    repo: project.repo,
    defaultBranch: project.defaultBranch,
    lastPolledAt: project.lastPolledAt?.toISOString() ?? null,
    isPublic: project.isPublic,
  }));

  // Tokens MCP do usuário (spec 019). Só os ATIVOS aparecem no card; datas em ISO p/ o client.
  const mcpTokens: McpTokenItem[] = (await listMcpTokens(user.id))
    .filter((token) => token.revokedAt === null)
    .map((token) => ({
      id: token.id,
      name: token.name,
      prefix: token.prefix,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
    }));

  return (
    <>
      <AppHeader title="Integrações" breadcrumb="Dashboard / Integrações" />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-8 py-6">
        {github === "connected" && (
          <p className="rounded-sm bg-status-done/10 px-4 py-3 text-[13px] text-status-done">
            GitHub conectado com sucesso.
          </p>
        )}
        {github === "error" && (
          <p className="rounded-sm bg-status-overdue/10 px-4 py-3 text-[13px] text-status-overdue">
            Não foi possível concluir a conexão com o GitHub. Tente novamente.
          </p>
        )}
        <GithubConnectionCard connection={conn} />
        <ProjectsManager projects={projectItems} connection={conn} />
        <McpSetupCard tokens={mcpTokens} appBaseUrl={env.APP_BASE_URL} />
      </div>
    </>
  );
}
