import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteTeam } from "@/lib/teams";

// DELETE /api/teams/:id — ADMIN: remove a equipe (cascade em team_members; projects.teamId
// some via onDelete:SetNull). `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await deleteTeam(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
