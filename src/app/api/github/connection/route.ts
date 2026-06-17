import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { disconnectGithub } from "@/lib/github/connection";

// DELETE /api/github/connection — autenticado: desconecta a conta do GitHub do usuário
// atual (idempotente). Cada usuário gere apenas a SUA conexão.

export async function DELETE() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await disconnectGithub(current.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
