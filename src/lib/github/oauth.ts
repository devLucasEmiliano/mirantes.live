import { env } from "@/lib/env";

// Único módulo que fala com o github.com no fluxo OAuth (troca de code + GET /user).
// `fetch` nativo (CLAUDE.md §0 — sem octokit). Honra GITHUB_OAUTH_FAKE p/ o e2e rodar
// SEM rede. Falhas viram GithubOAuthError com mensagem que NUNCA contém secret/code (§11).

const CALLBACK_PATH = "/api/github/oauth/callback";

export interface OAuthTokenResult {
  accessToken: string;
  scope: string;
  tokenType: string;
}

export interface GithubUser {
  login: string;
  id: number;
  avatarUrl: string | null;
}

/** Contrato injetável: a impl real fala com o GitHub; o e2e usa o modo faked. */
export interface GithubOAuthExchanger {
  exchangeCodeForToken(code: string): Promise<OAuthTokenResult>;
  fetchGithubUser(token: string): Promise<GithubUser>;
}

export class GithubOAuthError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GithubOAuthError";
  }
}

async function exchangeCodeForToken(code: string): Promise<OAuthTokenResult> {
  if (env.GITHUB_OAUTH_FAKE === "1") {
    return {
      accessToken: "gho_e2e_fake",
      scope: "repo,read:user",
      tokenType: "bearer",
    };
  }
  const body = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
    code,
    redirect_uri: `${env.APP_BASE_URL}${CALLBACK_PATH}`,
  });
  let res: Response;
  try {
    res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
    });
  } catch (cause) {
    throw new GithubOAuthError("falha de rede na troca do code OAuth", {
      cause,
    });
  }
  if (!res.ok) {
    throw new GithubOAuthError(
      `GitHub OAuth respondeu ${res.status} na troca do code`,
    );
  }
  const data = (await res.json()) as {
    access_token?: string;
    scope?: string;
    token_type?: string;
    error?: string;
  };
  if (data.error || !data.access_token) {
    // `data.error` é um código público do GitHub (ex.: bad_verification_code), sem segredo.
    throw new GithubOAuthError(
      `troca do code falhou: ${data.error ?? "sem access_token"}`,
    );
  }
  return {
    accessToken: data.access_token,
    scope: data.scope ?? "",
    tokenType: data.token_type ?? "bearer",
  };
}

async function fetchGithubUser(token: string): Promise<GithubUser> {
  if (env.GITHUB_OAUTH_FAKE === "1") {
    return { login: "e2e-bot", id: 4242, avatarUrl: null };
  }
  let res: Response;
  try {
    res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mirantes.live",
      },
    });
  } catch (cause) {
    throw new GithubOAuthError("falha de rede ao buscar o usuário do GitHub", {
      cause,
    });
  }
  if (!res.ok) {
    throw new GithubOAuthError(`GitHub /user respondeu ${res.status}`);
  }
  const data = (await res.json()) as {
    login: string;
    id: number;
    avatar_url?: string | null;
  };
  return { login: data.login, id: data.id, avatarUrl: data.avatar_url ?? null };
}

export const githubOAuth: GithubOAuthExchanger = {
  exchangeCodeForToken,
  fetchGithubUser,
};
