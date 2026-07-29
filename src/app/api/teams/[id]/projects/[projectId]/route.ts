import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { unassignProject } from "@/lib/teams";

// DELETE /api/teams/:id/projects/:projectId — ADMIN: desatribui o projeto da equipe (só limpa
// se o projeto pertence de fato a ESTA equipe). `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string; projectId: string }> };

export async function DELETE(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id, projectId } = await ctx.params;
  const result = await unassignProject(id, projectId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
