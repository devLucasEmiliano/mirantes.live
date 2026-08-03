import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { removeMember } from "@/lib/teams";

// DELETE /api/teams/:id/members/:userId — ADMIN: remove um membro da equipe (revoga a leitura
// compartilhada). `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, userId } = await ctx.params;
  const result = await removeMember(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
