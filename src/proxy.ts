import { type NextRequest, NextResponse } from "next/server";
import {
  buildSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/auth/cookie";

// Proxy (Next 16: ex-`middleware.ts`, runtime Node por padrão). Gate ÓTIMISTA das
// rotas autenticadas: verifica só a ASSINATURA do cookie (sem tocar no banco) e,
// quando válida, desliza a validade do cookie no navegador. A verificação real
// (linha de sessão, expiração, papel) fica no DAL e nos Route Handlers — SPEC §3.
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionId = verifySessionToken(token);

  if (!sessionId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  // Assinatura ok → re-grava o cookie com maxAge fresco (sliding do cookie).
  // (O DAL não pode escrever cookie durante o render; por isso o sliding mora aqui.)
  response.cookies.set(
    SESSION_COOKIE_NAME,
    token as string,
    buildSessionCookieOptions(),
  );
  return response;
}

// `/dashboard` exato + subárvore. Só essa área é protegida; `/` é pública.
export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
