import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
} from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

// POST /api/auth/login — público, com rate-limit em DUAS dimensões (SPEC §3/§4/§11):
// por IP e por email. Fluxo: limite IP → valida corpo → limite email → busca usuário
// → verifyPassword → cria sessão + cookie. Erros genéricos (401) p/ não vazar se o
// email existe; no sucesso, zera os contadores.

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(1),
});

function clientIp(request: Request): string {
  // Best-effort: X-Forwarded-For/X-Real-IP só são confiáveis atrás de um proxy que
  // sobrescreva esses headers (ex.: Nginx no deploy do SPEC §1). Sem isso, o cliente
  // pode forjá-los — por isso o rate-limit NÃO depende só do IP: há também a dimensão
  // por email (abaixo), imune à troca de header.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(retryAfter?: number): NextResponse {
  const headers = new Headers();
  if (retryAfter) headers.set("Retry-After", String(retryAfter));
  return NextResponse.json({ error: "rate_limited" }, { status: 429, headers });
}

export async function POST(request: Request) {
  const ip = clientIp(request);

  // 1) Limite por IP (barato, antes de parsear) — efetivo atrás de proxy confiável.
  const ipLimit = await checkLoginRateLimit(`ip:${ip}`);
  if (!ipLimit.ok) return rateLimited(ipLimit.retryAfter);

  const parsed = LoginBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // 2) Limite por email — defesa robusta: trocar o header de IP não escapa deste balde.
  const emailLimit = await checkLoginRateLimit(`email:${email}`);
  if (!emailLimit.ok) return rateLimited(emailLimit.retryAfter);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(user.passwordHash, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await createSession(user.id);
  // Sucesso: zera os contadores (não trava um usuário legítimo que errou antes).
  await Promise.all([
    clearLoginRateLimit(`ip:${ip}`),
    clearLoginRateLimit(`email:${email}`),
  ]);
  return NextResponse.json({ role: user.role }, { status: 200 });
}
