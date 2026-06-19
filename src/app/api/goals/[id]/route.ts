import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { archiveGoal, updateGoal } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";

// PATCH /api/goals/:id — ADMIN: edita a meta do ESCOPO (pai com filhos → 409 has_children;
// alheia/inexistente → 404). DELETE /api/goals/:id — ADMIN: arquiva (soft delete em cascata).
// `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().min(1).optional(),
  startValue: z.number().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
});

export async function PATCH(request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await updateGoal(scopeForUser(current), id, parsed.data);
  if (!result.ok) {
    const status = result.error === "has_children" ? 409 : 404;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ goal: result.goal }, { status: 200 });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await archiveGoal(scopeForUser(current), id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
