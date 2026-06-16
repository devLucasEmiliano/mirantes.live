import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

// POST /api/auth/password — autenticado (SPEC §3). Troca de senha do usuário logado:
// valida a senha atual, regrava o hash e invalida as DEMAIS sessões (mantém a atual).

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

  const user = await db.user.findUnique({ where: { id: current.id } });
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ok = await verifyPassword(
    user.passwordHash,
    parsed.data.currentPassword,
  );
  if (!ok) {
    return NextResponse.json(
      { error: "invalid_current_password" },
      { status: 401 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.session.deleteMany({
      where: { userId: user.id, NOT: { id: current.sessionId } },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 200 });
}
