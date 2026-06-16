import { NextResponse } from "next/server";
import { z } from "zod";
import { changePassword } from "@/lib/account/password";
import { getCurrentUser } from "@/lib/auth/session";

// POST /api/auth/password — autenticado (SPEC §3). Handler FINO: resolve a sessão,
// valida o corpo (zod) e delega ao serviço `changePassword` (testável). A troca
// regrava o hash e invalida as DEMAIS sessões (mantém a atual). Contrato inalterado.

const PasswordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = PasswordBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await changePassword(current.id, {
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
    keepSessionId: current.sessionId,
  });
  if (!result.ok) {
    // user_not_found e invalid_current_password → 401 (não revela qual).
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
