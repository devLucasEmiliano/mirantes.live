import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteProject, getProject } from "@/lib/projects";

// GET /api/projects/:id — autenticado: projeto + log de atividade (404 se não existe).
// DELETE /api/projects/:id — admin: remove o projeto (CASCADE nos filhos).
// `params` é Promise neste Next (App Router) — precisa de await.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await getProject(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  const { project } = result;
  return NextResponse.json(
    {
      project: {
        ...project,
        // runId é BigInt (não é JSON-safe) → String().
        workflowRuns: project.workflowRuns.map((run) => ({
          ...run,
          runId: String(run.runId),
        })),
      },
    },
    { status: 200 },
  );
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
  const result = await deleteProject(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
