import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createProject, listProjects, scopeForUser } from "@/lib/projects";

// GET /api/projects — autenticado: lista os projetos do ESCOPO (cliente só os seus,
// admin todos). POST /api/projects — autenticado: cria projeto (1 repo) carimbando o
// dono (current.id). Handler fino: sessão (401) → zod (400) → invalid_slug (400) /
// already_exists (409) / criado (201).

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { projects } = await listProjects(scopeForUser(current));
  return NextResponse.json({ projects }, { status: 200 });
}

const CreateBody = z.object({
  name: z.string().trim().max(120).optional(),
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { owner, repo } = parsed.data;
  // Nome é opcional; sem ele, usa o `repo` (o slug owner/repo aparece à parte na UI).
  const name = parsed.data.name?.length ? parsed.data.name : repo;

  const result = await createProject({ userId: current.id, name, owner, repo });
  if (!result.ok) {
    const status = result.error === "already_exists" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ project: result.project }, { status: 201 });
}
