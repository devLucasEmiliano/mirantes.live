import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { toGoalDTO } from "@/lib/goals/dto";
import { createGoal, listGoals } from "@/lib/goals/service";
import { scopeForUser } from "@/lib/projects";

// GET /api/goals — autenticado: árvore de metas do ESCOPO (cliente só de projeto próprio),
// opcionalmente filtrada por ?projectId. POST /api/goals — ADMIN: cria meta (X→Y ou manual).
// Handler fino: sessão (401) → papel (403) → zod (400) → service (404/400) → 201.

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const goals = await listGoals(scopeForUser(current), projectId);
  return NextResponse.json({ goals: goals.map(toGoalDTO) }, { status: 200 });
}

const CreateBody = z.object({
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  parentId: z.string().uuid().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  dueDate: z.string().min(1),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
});

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
  const result = await createGoal(scopeForUser(current), {
    projectId: parsed.data.projectId ?? null,
    title: parsed.data.title,
    description: parsed.data.description,
    parentId: parsed.data.parentId,
    status: parsed.data.status,
    dueDate: parsed.data.dueDate,
    startValue: parsed.data.startValue,
    targetValue: parsed.data.targetValue,
    currentValue: parsed.data.currentValue,
  });
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ goal: result.goal }, { status: 201 });
}
