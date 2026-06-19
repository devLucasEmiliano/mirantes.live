// Servidor MCP de Metas (spec 013): monta um `McpServer` e registra as 6 tools (zod) ligando
// ao escopo resolvido pelo token. Cada tool delega ao handler em `tools.ts` (reuso do service)
// e devolve o JSON do resultado como texto. Transporte (stdio) e auth ficam no `entry.ts`.
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
  metasUpdate,
} from "./tools";

const STATUS = z.enum(["todo", "in_progress", "done"]);

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

export function createMetasMcpServer(scope: Scope): McpServer {
  const server = new McpServer({ name: "mirantes-metas", version: "1.0.0" });
  const register = server.registerTool.bind(server) as unknown as RegisterFn;

  register(
    "metas_list",
    {
      title: "Listar metas",
      description:
        "Lista a árvore de metas do escopo (opcionalmente filtrada por projeto).",
      inputSchema: { projectId: z.string().uuid().optional() },
    },
    async (args) =>
      asText(await metasList(scope, args as { projectId?: string })),
  );

  register(
    "metas_create",
    {
      title: "Criar meta",
      description:
        "Cria uma meta. Com targetValue vira X→Y medível; sem, é manual (0–100).",
      inputSchema: {
        projectId: z.string().uuid(),
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
        ),
      ),
  );

  register(
    "metas_update",
    {
      title: "Atualizar meta",
      description:
        "Edita campos de uma meta-folha (pai é derivado, read-only).",
      inputSchema: {
        goalId: z.string().uuid(),
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
        ),
      ),
  );

  register(
    "metas_archive",
    {
      title: "Arquivar meta",
      description: "Soft delete em cascata da meta e de seus descendentes.",
      inputSchema: { goalId: z.string().uuid() },
    },
    async (args) =>
      asText(await metasArchive(scope, args as unknown as { goalId: string })),
  );

  register(
    "metas_link_branch",
    {
      title: "Vincular branch à meta",
      description:
        "Liga uma branch à meta (base da atribuição determinística por branch/merge).",
      inputSchema: {
        goalId: z.string().uuid(),
        branchName: z.string().min(1),
      },
    },
    async (args) =>
      asText(
        await metasLinkBranch(
          scope,
          args as unknown as { goalId: string; branchName: string },
        ),
      ),
  );

  register(
    "metas_link_commit",
    {
      title: "Vincular commit à meta",
      description:
        "Liga um commit (por sha, no projeto da meta) e aplica o peso UMA vez (idempotente).",
      inputSchema: {
        goalId: z.string().uuid(),
        commitSha: z.string().min(1),
      },
    },
    async (args) =>
      asText(
        await metasLinkCommit(
          scope,
          args as unknown as { goalId: string; commitSha: string },
        ),
      ),
  );

  return server;
}
