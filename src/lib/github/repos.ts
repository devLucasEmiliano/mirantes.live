import { env } from "@/lib/env";
import {
  createGitHubClient,
  type GitHubClient,
  GitHubError,
} from "@/lib/github/client";
import { resolveUserToken } from "@/lib/github/connection";

// Lista os repositórios da conta GitHub conectada do usuário, p/ o seletor de projetos em
// Integrações. Resolve o token do PRÓPRIO usuário (cifrado no banco) e chama GET /user/repos.
// Cap de 100 repos (1 página) — o fallback manual da UI cobre a cauda. O modo faked
// (GITHUB_OAUTH_FAKE) entra DEPOIS da resolução do token: assim o e2e roda sem rede E um
// usuário não-conectado continua sem repos (resolve para not_connected antes do fake).

export interface UserRepo {
  owner: string;
  repo: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
}

export type ListUserReposResult =
  | { ok: true; repos: UserRepo[] }
  | { ok: false; error: "not_connected" | "github_error" };

/** Repos determinísticos p/ o e2e (GITHUB_OAUTH_FAKE). Inclui um já-adicionado pelo seed. */
const FAKE_REPOS: UserRepo[] = [
  {
    owner: "e2e-bot",
    repo: "hello-world",
    fullName: "e2e-bot/hello-world",
    private: false,
    defaultBranch: "main",
  },
  {
    owner: "e2e-bot",
    repo: "sandbox",
    fullName: "e2e-bot/sandbox",
    private: true,
    defaultBranch: "main",
  },
  {
    owner: "devlucasemiliano",
    repo: "mirantes.live",
    fullName: "devlucasemiliano/mirantes.live",
    private: false,
    defaultBranch: "main",
  },
];

export async function listUserRepos(
  userId: string,
  client?: GitHubClient,
): Promise<ListUserReposResult> {
  // Token do dono PRIMEIRO: sem conexão (ou token inválido) → not_connected, sem tocar a rede.
  const resolved = await resolveUserToken(userId);
  if (!resolved.ok) return { ok: false, error: "not_connected" };

  try {
    let gh: GitHubClient;
    if (client !== undefined) {
      gh = client; // teste injeta o stub
    } else if (env.GITHUB_OAUTH_FAKE === "1") {
      return { ok: true, repos: FAKE_REPOS }; // e2e sem rede
    } else {
      gh = createGitHubClient(resolved.token);
    }
    const repos = (await gh.listRepos()).map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
    return { ok: true, repos };
  } catch (error) {
    if (error instanceof GitHubError)
      return { ok: false, error: "github_error" };
    throw error;
  }
}
