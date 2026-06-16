import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

// POST /api/auth/login — público, com rate-limit por IP (SPEC §3/§4).
// Fluxo: rate-limit → valida corpo → busca usuário → verifyPassword → cria sessão
// + cookie assinado. Erros genéricos (401) p/ não vazar se o email existe.

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const rate = await checkLoginRateLimit(clientIp(request));
  if (!rate.ok) {
    const headers = new Headers();
    if (rate.retryAfter) headers.set("Retry-After", String(rate.retryAfter));
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers },
    );
  }

  const parsed = LoginBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ role: user.role }, { status: 200 });
}
