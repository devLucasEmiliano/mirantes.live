import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { assignProject } from "@/lib/teams";

// POST /api/teams/:id/projects — ADMIN: atribui um projeto à equipe (1 projeto → no máx. 1
// equipe; se já tinha outra, MOVE). `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ projectId: z.string().uuid() });

export async function POST(request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const result = await assignProject(id, parsed.data.projectId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
