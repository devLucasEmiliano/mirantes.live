import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { syncProject } from "@/lib/github/sync";

// POST /api/projects/:id/sync — admin: dispara o MESMO `syncProject` do worker.
// Mapa de erro → HTTP: no_token → 409, project_not_found → 404, github_error → 502.

type Ctx = { params: Promise<{ id: string }> };

const ERROR_STATUS: Record<string, number> = {
  no_token: 409,
  project_not_found: 404,
  github_error: 502,
};

export async function POST(_request: Request, ctx: Ctx) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
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
