import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { deleteProject, getProject, scopeForUser } from "@/lib/projects";

// GET /api/projects/:id — autenticado: projeto + log de atividade do ESCOPO (404 se não
// existe OU não é do cliente). DELETE /api/projects/:id — autenticado: remove o projeto
// do ESCOPO (CASCADE nos filhos; alheio → 404). `params` é Promise neste Next.

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const result = await getProject(id, scopeForUser(current));
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
  const { id } = await ctx.params;
  const result = await deleteProject(id, scopeForUser(current));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
