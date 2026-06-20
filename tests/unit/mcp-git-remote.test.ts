import { describe, expect, it } from "vitest";
import { parseGitRemote } from "@/lib/mcp/project-context";

describe("parseGitRemote", () => {
  it("https com .git", () =>
    expect(
      parseGitRemote("https://github.com/devlucasemiliano/mirantes.live.git"),
    ).toEqual({ owner: "devlucasemiliano", repo: "mirantes.live" }));
  it("https sem .git", () =>
    expect(parseGitRemote("https://github.com/o/r")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("ssh scp-like", () =>
    expect(parseGitRemote("git@github.com:o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("ssh:// url", () =>
    expect(parseGitRemote("ssh://git@github.com/o/r.git")).toEqual({
      owner: "o",
      repo: "r",
    }));
  it("lixo → null", () => expect(parseGitRemote("not a url")).toBeNull());
  it("vazio → null", () => expect(parseGitRemote("")).toBeNull());
});
