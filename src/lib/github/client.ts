// Único ponto HTTP com o GitHub (SPEC §7). `fetch` nativo — sem Octokit (CLAUDE.md §0).
// O token (OAuth, do dono do projeto) chega por parâmetro e NUNCA aparece em mensagem
// de erro, log ou URL: vai apenas no header Authorization. A interface `GitHubClient`
// é injetável p/ o sync ser testado com stub (tests/setup/github.ts), sem rede.

const API_BASE = "https://api.github.com";

/** Autor git embutido no commit (≠ conta GitHub). `name` pode faltar. */
export interface GhCommitAuthor {
  name: string | null;
  date: string;
}

export interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: GhCommitAuthor };
  /** Conta GitHub resolvida — null quando o autor não tem conta vinculada. */
  author: { login: string } | null;
}

export interface GhBranch {
  name: string;
  commit: { sha: string };
  protected: boolean;
}

export interface GhWorkflowRun {
  id: number;
  name: string;
  head_branch: string | null;
  head_sha: string;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string | null;
  updated_at: string;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Contrato injetável: a impl real fala com a API; os testes injetam um stub. */
export interface GitHubClient {
  getRepo(input: RepoRef): Promise<{ name: string; defaultBranch: string }>;
  listCommits(
    input: RepoRef & { since?: string; sha?: string; perPage?: number },
  ): Promise<GhCommit[]>;
  listBranches(input: RepoRef & { perPage?: number }): Promise<GhBranch[]>;
  listWorkflowRuns(
    input: RepoRef & { perPage?: number },
  ): Promise<GhWorkflowRun[]>;
}

/** Erro de borda do GitHub (rede/HTTP). Mensagem nunca contém o PAT. */
export class GitHubError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = "GitHubError";
    this.status = status;
  }
}

function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mirantes.live",
  };
}

async function ghGet<T>(path: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { headers: buildHeaders(token) });
  } catch (cause) {
    // O token está só nos headers; a mensagem/cause não o contêm.
    throw new GitHubError("falha de rede ao contatar o GitHub", undefined, {
      cause,
    });
  }
  if (!res.ok) {
    // `path` traz owner/repo (público), nunca o token.
    throw new GitHubError(
      `GitHub respondeu ${res.status} em ${path}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

/**
 * Cria o cliente real do GitHub a partir de um token OAuth (do dono do projeto). O
 * token vai SÓ no header Authorization. Em teste injeta-se o stub (tests/setup/github.ts)
 * e este caminho não é exercido.
 */
export function createGitHubClient(token: string): GitHubClient {
  const auth = token;
  return {
    async getRepo({ owner, repo }) {
      const data = await ghGet<{ name: string; default_branch: string }>(
        `/repos/${owner}/${repo}`,
        auth,
      );
      return { name: data.name, defaultBranch: data.default_branch };
    },
    async listCommits({ owner, repo, since, sha, perPage = 100 }) {
      const params = new URLSearchParams({ per_page: String(perPage) });
      if (since) params.set("since", since);
      if (sha) params.set("sha", sha);
      return ghGet<GhCommit[]>(
        `/repos/${owner}/${repo}/commits?${params.toString()}`,
        auth,
      );
    },
    async listBranches({ owner, repo, perPage = 100 }) {
      const params = new URLSearchParams({ per_page: String(perPage) });
      return ghGet<GhBranch[]>(
        `/repos/${owner}/${repo}/branches?${params.toString()}`,
        auth,
      );
    },
    async listWorkflowRuns({ owner, repo, perPage = 50 }) {
      const params = new URLSearchParams({ per_page: String(perPage) });
      const data = await ghGet<{ workflow_runs: GhWorkflowRun[] }>(
        `/repos/${owner}/${repo}/actions/runs?${params.toString()}`,
        auth,
      );
      return data.workflow_runs;
    },
  };
}
