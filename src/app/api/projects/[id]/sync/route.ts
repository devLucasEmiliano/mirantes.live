import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { syncProject } from "@/lib/github/sync";
import { getProject, scopeForUser } from "@/lib/projects";

// POST /api/projects/:id/sync — autenticado: dispara o MESMO `syncProject` do worker no
// projeto do ESCOPO (cliente só os seus; alheio/inexistente → 404). O sync usa o token
// do DONO. Erro → HTTP: not_connected → 409, project_not_found → 404, github_error → 502.

type Ctx = { params: Promise<{ id: string }> };

const ERROR_STATUS: Record<string, number> = {
  not_connected: 409,
  project_not_found: 404,
  github_error: 502,
};

export async function POST(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  // Ownership: cliente só sincroniza os seus; projeto alheio/inexistente → 404.
  const access = await getProject(id, scopeForUser(current));
  if (!access.ok) {
    return NextResponse.json({ error: "project_not_found" }, { status: 404 });
  }

  const result = await syncProject(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: ERROR_STATUS[result.error] ?? 500 },
    );
  }
  return NextResponse.json(
    { ok: true, inserted: result.inserted, lastSeenSha: result.lastSeenSha },
    { status: 200 },
  );
}
