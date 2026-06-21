// Executável do servidor MCP de Metas (spec 013): `bun run mcp`. Fail-closed — sem
// MCP_SERVICE_TOKEN válido, recusa iniciar. Transporte stdio (stdout é do protocolo; logs vão p/
// stderr). Saída limpa em SIGINT/SIGTERM. Bun carrega o .env automaticamente.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "@/lib/env";
import { resolveScopeFromToken } from "./auth";
import { createMetasMcpServer } from "./server";

async function main(): Promise<void> {
  const scope = await resolveScopeFromToken(env.MCP_SERVICE_TOKEN);
  if (!scope) {
    console.error(
      "[mcp] MCP_SERVICE_TOKEN ausente/curto — recusando iniciar (fail-closed).",
    );
    process.exit(1);
  }

  const server = createMetasMcpServer(scope);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] servidor de Metas no ar (stdio).");

  const shutdown = async () => {
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Cast idiomático do projeto (evita depender de `bun-types` no `tsc --noEmit`).
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  main().catch((err) => {
    console.error("[mcp] falha fatal:", err);
    process.exit(1);
  });
}
