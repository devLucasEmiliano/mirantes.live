import type {
  GhBranch,
  GhCommit,
  GhWorkflowRun,
  GitHubClient,
} from "@/lib/github/client";

export function makeStubClient(data: {
  name?: string;
  defaultBranch: string;
  commits: GhCommit[];
  branches: GhBranch[];
  runs: GhWorkflowRun[];
}): GitHubClient {
  return {
    getRepo: async () => ({
      name: data.name ?? "repo",
      defaultBranch: data.defaultBranch,
    }),
    listCommits: async () => data.commits,
    listBranches: async () => data.branches,
    listWorkflowRuns: async () => data.runs,
  };
}

export function ghCommit(
  sha: string,
  message = "feat: x",
  date = "2026-06-10T12:00:00Z",
): GhCommit {
  return {
    sha,
    html_url: `https://github.com/o/r/commit/${sha}`,
    commit: { message, author: { name: "Ana", date } },
    author: { login: "ana-gh" },
  };
}
export function ghBranch(name: string, sha = "deadbeef"): GhBranch {
  return { name, commit: { sha }, protected: false };
}
export function ghRun(
  id: number,
  overrides: Partial<GhWorkflowRun> = {},
): GhWorkflowRun {
  return {
    id,
    name: "CI",
    head_branch: "main",
    head_sha: "deadbeef",
    run_number: id,
    status: "completed",
    conclusion: "success",
    html_url: `https://github.com/o/r/actions/runs/${id}`,
    run_started_at: "2026-06-10T12:00:00Z",
    updated_at: "2026-06-10T12:05:00Z",
    ...overrides,
  };
}
