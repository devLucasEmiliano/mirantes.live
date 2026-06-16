import { NextResponse } from "next/server";
import { z } from "zod";
import { updateProfile } from "@/lib/account/profile";
import { getCurrentUser } from "@/lib/auth/session";

// PATCH /api/account/profile — autenticado. Atualiza nome + email do usuário logado.
// Handler fino: sessão (401) → valida corpo (400) → serviço → email_taken (409).

const ProfileBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
});

export async function PATCH(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = ProfileBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await updateProfile(current.id, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ user: result.user }, { status: 200 });
}
