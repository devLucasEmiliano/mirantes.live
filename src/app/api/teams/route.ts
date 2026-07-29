import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createTeam, listTeams } from "@/lib/teams";

// GET /api/teams — ADMIN: lista todas as equipes (com membros e projetos). POST /api/teams —
// ADMIN: cria equipe. Handler fino: sessão (401) → papel (403) → zod (400) → service → 200/201.

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const teams = await listTeams();
  return NextResponse.json({ teams }, { status: 200 });
}

const CreateBody = z.object({ name: z.string().trim().min(1).max(120) });

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (current.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const team = await createTeam(parsed.data.name);
  return NextResponse.json({ team }, { status: 201 });
}
