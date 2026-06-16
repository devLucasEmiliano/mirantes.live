import { NextResponse } from "next/server";
import {
  clearAvatar,
  getAvatar,
  setAvatar,
  validateAvatar,
} from "@/lib/account/avatar";
import { getCurrentUser } from "@/lib/auth/session";

// GET/PUT/DELETE /api/account/avatar — foto do usuário logado (bytea no Postgres).
// GET serve os bytes (é a `src` do <img>); PUT recebe multipart e valida; DELETE limpa.

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const avatar = await getAvatar(current.id);
  if (!avatar) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new Response(new Uint8Array(avatar.data), {
    status: 200,
    headers: {
      "Content-Type": avatar.mimeType,
      // Privado ao usuário; revalida sempre (o ?v=updatedAt já força o refresh).
      "Cache-Control": "private, no-cache",
    },
  });
}

export async function PUT(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  const check = validateAvatar({ mimeType: file.type, size: file.size });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  await setAvatar(current.id, { bytes, mimeType: file.type });
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await clearAvatar(current.id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
