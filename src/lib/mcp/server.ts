// Servidor MCP de Metas (spec 013/015): monta um `McpServer` e registra as tools (zod) ligando
// ao escopo resolvido pelo token. Cada tool delega ao handler em `tools.ts` (reuso do service)
// e devolve o JSON do resultado como texto. Transporte e auth ficam no route HTTP `/api/mcp`
// (spec 020): Bearer → `resolveScopeFromToken` → escopo; `WebStandardStreamableHTTPServerTransport`
// stateless por requisição. (O stdio/`entry.ts` foi removido na spec 020.)
//
// Spec 015: o projeto pode vir por `project` (owner/repo|repo|name) ou ser inferido do `git
// remote origin` do cwd (o "projeto atual"); a meta pode vir por `shortCode` (M-1) além de
// `goalId`. `projectId`/`goalId` UUID seguem aceitos (retrocompatível).
//
// Nota de compat: o SDK 1.29 traz uma cópia ANINHADA de zod (3.25, v4-core) só para os tipos de
// `registerTool`; o app usa zod 4.4. Os schemas funcionam em runtime (mesmo v4-core), mas as
// identidades de TIPO diferem entre as duas cópias. `register` faz a ponte: tipa a chamada pela
// nossa zod e os handlers pelos nossos inputs; o SDK valida com zod em runtime.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Scope } from "@/lib/projects";
import {
  metasArchive,
  metasCreate,
  metasLinkBranch,
  metasLinkCommit,
  metasList,
  metasProjects,
  metasUpdate,
} from "./tools";

const STATUS = z.enum(["todo", "in_progress", "done"]);

// Como apontar o projeto: `project` humano (owner/repo|repo|name) OU `projectId` UUID; ausentes
// → "projeto atual" pelo git remote. Reutilizado em todas as tools que precisam de projeto.
const PROJECT_REF = {
  project: z
    .string()
    .optional()
    .describe("Projeto por owner/repo, repo ou nome (case-insensitive)."),
  projectId: z.string().uuid().optional(),
};

// Como apontar a meta: `goalId` UUID OU `shortCode` (M-1) resolvido no projeto. Inclui PROJECT_REF
// porque o short code precisa do projeto p/ ser resolvido.
const GOAL_REF = {
  ...PROJECT_REF,
  goalId: z.string().uuid().optional(),
  shortCode: z
    .string()
    .optional()
    .describe("Short code da meta no projeto, ex. M-1."),
};

type ToolResult = { content: { type: "text"; text: string }[] };
type RegisterFn = (
  name: string,
  config: {
    title: string;
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
  },
  cb: (args: Record<string, unknown>) => Promise<ToolResult>,
) => void;

function asText(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

// `opts.detectRepo` (spec 020): repassado a cada handler que resolve projeto. O transporte HTTP
// (`/api/mcp`) passa `{ detectRepo: false }` (sem git do servidor); o stdio não passava nada.
export function createMetasMcpServer(
  scope: Scope,
  opts?: { detectRepo?: boolean },
): McpServer {
  const server = new McpServer({ name: "mirantes-metas", version: "1.0.0" });
  const register = server.registerTool.bind(server) as unknown as RegisterFn;

  register(
    "metas_list",
    {
      title: "Listar metas",
      description:
        "Lista a árvore de metas do projeto atual (git remote) ou de `project`/`projectId`. Sem projeto resolvível, lista todo o escopo.",
      inputSchema: { ...PROJECT_REF },
    },
    async (args) =>
      asText(
        await metasList(
          scope,
          args as { project?: string; projectId?: string },
          opts,
        ),
      ),
  );

  register(
    "metas_create",
    {
      title: "Criar meta",
      description:
        "Cria uma meta no projeto atual (git remote) ou em `project`/`projectId`. Com targetValue vira X→Y medível; sem, é manual (0–100).",
      inputSchema: {
        ...PROJECT_REF,
        title: z.string().min(1),
        dueDate: z.string(),
        description: z.string().optional(),
        parentId: z.string().uuid().optional(),
        status: STATUS.optional(),
        startValue: z.number().optional(),
        targetValue: z.number().optional(),
        currentValue: z.number().optional(),
      },
    },
    async (args) =>
      asText(
        await metasCreate(
          scope,
          args as unknown as Parameters<typeof metasCreate>[1],
          opts,
        ),
      ),
  );

  register(
    "metas_update",
    {
      title: "Atualizar meta",
      description:
        "Edita campos de uma meta-folha (pai é derivado, read-only). Aponte por `goalId` ou `shortCode` (+ projeto).",
      inputSchema: {
        ...GOAL_REF,
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: STATUS.optional(),
        progress: z.number().int().min(0).max(100).optional(),
        dueDate: z.string().optional(),
        startValue: z.number().nullable().optional(),
        targetValue: z.number().nullable().optional(),
        currentValue: z.number().nullable().optional(),
      },
    },
    async (args) =>
      asText(
        await metasUpdate(
          scope,
          args as unknown as Parameters<typeof metasUpdate>[1],
          opts,
        ),
      ),
  );

  register(
    "metas_archive",
    {
      title: "Arquivar meta",
      description:
        "Soft delete em cascata da meta e de seus descendentes. Aponte por `goalId` ou `shortCode` (+ projeto).",
      inputSchema: { ...GOAL_REF },
    },
    async (args) =>
      asText(
        await metasArchive(
          scope,
          args as unknown as Parameters<typeof metasArchive>[1],
          opts,
        ),
      ),
  );

  register(
    "metas_link_branch",
    {
      title: "Vincular branch à meta",
      description:
        "Liga uma branch à meta (base da atribuição determinística por branch/merge). Aponte por `goalId` ou `shortCode`.",
      inputSchema: {
        ...GOAL_REF,
        branchName: z.string().min(1),
      },
    },
    async (args) =>
      asText(
        await metasLinkBranch(
          scope,
          args as unknown as Parameters<typeof metasLinkBranch>[1],
          opts,
        ),
      ),
  );

  register(
    "metas_link_commit",
    {
      title: "Vincular commit à meta",
      description:
        "Liga um commit (por sha, no projeto da meta) e aplica o peso UMA vez (idempotente). Aponte a meta por `goalId` ou `shortCode`.",
      inputSchema: {
        ...GOAL_REF,
        commitSha: z.string().min(1),
      },
    },
    async (args) =>
      asText(
        await metasLinkCommit(
          scope,
          args as unknown as Parameters<typeof metasLinkCommit>[1],
          opts,
        ),
      ),
  );

  register(
    "metas_projects",
    {
      title: "Listar projetos",
      description:
        "Lista os projetos do escopo ({ id, name, owner, repo }) p/ escolher `project` ou conferir o projeto atual.",
      inputSchema: {},
    },
    async () => asText(await metasProjects(scope)),
  );

  return server;
}
