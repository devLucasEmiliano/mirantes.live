import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { createMcpToken, listMcpTokens } from "@/lib/mcp/tokens";

// GET /api/mcp-tokens — autenticado: lista os tokens MCP do PRÓPRIO usuário (sem hash).
// POST /api/mcp-tokens — autenticado: cria um token e devolve o texto puro UMA vez (201).
// Handler fino: sessão (401) → zod (400) → cria (201). O escopo é sempre `current.id`
// (cada usuário só mexe nos seus tokens; não há acesso por papel aqui).

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tokens = await listMcpTokens(current.id);
  return NextResponse.json({ tokens }, { status: 200 });
}

const CreateBody = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CreateBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // O texto puro vai na resposta UMA vez; depois só vive o hash no banco.
  const { token, view } = await createMcpToken(current.id, parsed.data.name);
  return NextResponse.json({ token, view }, { status: 201 });
}
