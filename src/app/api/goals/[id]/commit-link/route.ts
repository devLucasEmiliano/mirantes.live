import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { linkCommit } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";

// POST /api/goals/:id/commit-link — ADMIN: liga um commit à meta e aplica o peso UMA vez
// (idempotente via unique commit_id+goal_id). Meta/commit inexistente → 404.

type Ctx = { params: Promise<{ id: string }> };

const LinkBody = z.object({ commitId: z.string().uuid() });

export async function POST(request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = LinkBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await linkCommit(scopeForUser(current), {
    goalId: id,
    commitId: parsed.data.commitId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
