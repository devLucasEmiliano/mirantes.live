import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { connectGithub } from "@/lib/github/connection";
import { githubOAuth } from "@/lib/github/oauth";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
  verifyOAuthState,
} from "@/lib/github/oauth-state";

// GET /api/github/oauth/callback — autenticado. Confere o state (assinatura + igualdade
// byte-a-byte com o cookie + dono = usuário atual), troca o code pelo token, busca o
// usuário do GitHub e grava a conexão cifrada. SEMPRE 303 p/ /integracoes
// (?github=connected|error); NUNCA ecoa o erro cru.

function backTo(result: "connected" | "error"): NextResponse {
  const url = new URL("/dashboard/integracoes", env.APP_BASE_URL);
  url.searchParams.set("github", result);
  const res = NextResponse.redirect(url, 303);
  // Cookie de state é one-shot: expira-o sempre (no acerto e no erro).
  res.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: 0,
  });
  return res;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function GET(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("error")) return backTo("error");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  const cookieState = store.get(OAUTH_STATE_COOKIE)?.value ?? null;

  // CSRF: state presente, igual ao cookie (byte-safe), assinado e do usuário atual.
  if (!code || !state || !cookieState || !safeEqual(state, cookieState)) {
    return backTo("error");
  }
  const verified = verifyOAuthState(state);
  if (!verified || verified.userId !== current.id) return backTo("error");

  try {
    const token = await githubOAuth.exchangeCodeForToken(code);
    const ghUser = await githubOAuth.fetchGithubUser(token.accessToken);
    await connectGithub(current.id, {
      accessToken: token.accessToken,
      login: ghUser.login,
      githubUserId: ghUser.id,
      scopes: token.scope,
    });
    return backTo("connected");
  } catch (error) {
    console.error("[github oauth callback] falhou:", error);
    return backTo("error");
  }
}
