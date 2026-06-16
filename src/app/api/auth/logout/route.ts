import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

// POST /api/auth/logout — autenticado. Apaga a linha de sessão e limpa o cookie.
// Idempotente: chamar sem sessão válida apenas limpa o cookie e responde 200.
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
