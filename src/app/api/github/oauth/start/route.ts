import { NextResponse } from "next/server";
import { buildSessionCookieOptions } from "@/lib/auth/cookie";
import { getCurrentUser } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  createOAuthState,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_COOKIE_PATH,
} from "@/lib/github/oauth-state";

// GET /api/github/oauth/start — autenticado. Gera o `state` (anti-CSRF), grava-o num
// cookie httpOnly de vida curta (10 min) e redireciona (307) ao authorize do GitHub.
// O callback confere o state contra esse cookie.

export async function GET() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = createOAuthState(current.id);

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  authorize.searchParams.set(
    "redirect_uri",
    `${env.APP_BASE_URL}/api/github/oauth/callback`,
  );
  authorize.searchParams.set("scope", "repo read:user");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize, 307);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    ...buildSessionCookieOptions(),
    path: OAUTH_STATE_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
