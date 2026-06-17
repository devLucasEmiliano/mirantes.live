import { expect, it } from "vitest";
import { GitHubError } from "@/lib/github/client";
import { connectGithub } from "@/lib/github/connection";
import { listUserRepos } from "@/lib/github/repos";
import { seedUser } from "../setup/db";
import { ghRepo, makeStubClient } from "../setup/github";

const CONN = {
  accessToken: "gho_test_token_123",
  login: "ana-gh",
  githubUserId: 4242,
  scopes: "repo,read:user",
};

function stub(userRepos: ReturnType<typeof ghRepo>[]) {
  return makeStubClient({
    defaultBranch: "main",
    commits: [],
    branches: [],
    runs: [],
    userRepos,
  });
}

it("sem conexão → not_connected (resolve o token ANTES de usar o client)", async () => {
  const user = await seedUser({ email: "a@x.com", password: "pass-123" });
  const res = await listUserRepos(user.id, stub([ghRepo("o", "r1")]));
  expect(res).toEqual({ ok: false, error: "not_connected" });
});

it("conectado → devolve os repos mapeados", async () => {
  const user = await seedUser({ email: "b@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const res = await listUserRepos(
    user.id,
    stub([
      ghRepo("o", "r1"),
      ghRepo("o", "r2", { private: true, default_branch: "dev" }),
    ]),
  );
  expect(res).toEqual({
    ok: true,
    repos: [
      {
        owner: "o",
        repo: "r1",
        fullName: "o/r1",
        private: false,
        defaultBranch: "main",
      },
      {
        owner: "o",
        repo: "r2",
        fullName: "o/r2",
        private: true,
        defaultBranch: "dev",
      },
    ],
  });
});

it("erro de borda do GitHub → github_error", async () => {
  const user = await seedUser({ email: "c@x.com", password: "pass-123" });
  await connectGithub(user.id, CONN);
  const failing = makeStubClient({
    defaultBranch: "main",
    commits: [],
    branches: [],
    runs: [],
    userReposError: new GitHubError("boom", 502),
  });
  expect(await listUserRepos(user.id, failing)).toEqual({
    ok: false,
    error: "github_error",
  });
});
