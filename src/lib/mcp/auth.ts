// Auth do servidor MCP (spec 013): um único token de serviço (env `MCP_SERVICE_TOKEN`) concede
// escopo ADMIN. Fail-closed — sem token configurado ou token diferente → null (recusa). Tokens
// por-usuário/HTTP ficam para evolução futura (aqui só stdio + serviço).
import { env } from "@/lib/env";
import type { Scope } from "@/lib/projects";

export function resolveScopeFromToken(token: string | undefined): Scope | null {
  const expected = env.MCP_SERVICE_TOKEN;
  if (!expected || !token) return null;
  if (token !== expected) return null;
  return { role: "admin" };
}
