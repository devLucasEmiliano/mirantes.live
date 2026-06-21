// Route HTTP do servidor MCP de Metas (spec 020): expõe as 7 tools por HTTP em `/api/mcp`,
// autenticado por Bearer token pessoal (spec 019). Substitui o transporte stdio (`entry.ts`,
// removido nesta spec). Padrão canônico do SDK 1.29: 1 `McpServer` + 1 transport POR REQUISIÇÃO,
// `WebStandardStreamableHTTPServerTransport` stateless (`sessionIdGenerator: undefined`) +
// `enableJsonResponse` (resposta JSON, sem SSE de vida longa). O `Request` web entra direto e
// `handleRequest` devolve um `Response` web — encaixa no route handler do App Router.
//
// `detectRepo: false`: o `git remote` do SERVIDOR não faz sentido aqui (leria o repo do servidor,
// não o do cliente); as tools operam sobre TODO o escopo do dono do token, salvo `project`/`projectId`
// explícito. Auth (`auth.ts`): Bearer == env `MCP_SERVICE_TOKEN` → admin; token pessoal ativo →
// `{ client, userId }`; ausente/inválido → 401.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { resolveScopeFromToken } from "@/lib/mcp/auth";
import { createMetasMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const scope = await resolveScopeFromToken(token);
  if (!scope) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized" },
      },
      { status: 401 },
    );
  }

  // 1 server + 1 transport por requisição (stateless): isola escopo/IDs entre clientes.
  const server = createMetasMcpServer(scope, { detectRepo: false });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Mesmo handler p/ POST (JSON-RPC), GET (stream) e DELETE (encerrar sessão). O gate de Bearer
// vale para os três; em stateless, GET/DELETE não mantêm estado entre requisições.
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handle(request);
}
