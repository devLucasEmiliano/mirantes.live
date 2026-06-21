import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { revokeMcpToken } from "@/lib/mcp/tokens";

// DELETE /api/mcp-tokens/:id — autenticado: revoga um token do PRÓPRIO usuário. `params` é
// Promise neste Next (App Router) → `await ctx.params`. Token alheio/inexistente → 404
// (escopado em `revokeMcpToken(current.id, id)`); sucesso → { ok: true } 200.

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await revokeMcpToken(current.id, id);
  if (!result.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
