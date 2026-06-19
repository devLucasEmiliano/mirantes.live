import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { linkBranch, unlinkBranch } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";

// POST /api/goals/:id/branch-link — ADMIN: vincula uma branch à meta (atribuição determinística:
// commit na branch / merge dela → meta). DELETE — ADMIN: desfaz o vínculo. Meta alheia → 404.

type Ctx = { params: Promise<{ id: string }> };

const BranchBody = z.object({ branchName: z.string().trim().min(1).max(255) });

export async function POST(request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = BranchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await linkBranch(
    scopeForUser(current),
    id,
    parsed.data.branchName,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = BranchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const result = await unlinkBranch(
    scopeForUser(current),
    id,
    parsed.data.branchName,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
