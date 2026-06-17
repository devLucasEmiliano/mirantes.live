import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { listEvents } from "@/lib/events";
import { scopeForUser } from "@/lib/projects";

// GET /api/events — autenticado: timeline paginada do ESCOPO (cliente só visível + próprio/
// global; admin tudo). Query: projectId? (uuid), cursor? (events.id), limit? (1–100). Handler
// fino: sessão (401) → zod (400) → listEvents. PUBLISH/SSE seguem pendentes da spec 014.

const Query = z.object({
  projectId: z.string().uuid().optional(),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const parsed = Query.safeParse({
    projectId: searchParams.get("projectId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }
  const result = await listEvents(scopeForUser(current), parsed.data);
  return NextResponse.json(result, { status: 200 });
}
