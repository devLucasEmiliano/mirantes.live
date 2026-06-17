import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserRepos } from "@/lib/github/repos";

// GET /api/github/repos — autenticado: lista os repositórios da conta GitHub conectada do
// usuário (token do DONO; GET /user/repos). Usado pelo seletor de "adicionar projeto" em
// Integrações; a UI filtra os já adicionados. not_connected→409, github_error→502.

const ERROR_STATUS: Record<string, number> = {
  not_connected: 409,
  github_error: 502,
};

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await listUserRepos(current.id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: ERROR_STATUS[result.error] ?? 500 },
    );
  }
  return NextResponse.json({ repos: result.repos }, { status: 200 });
}
