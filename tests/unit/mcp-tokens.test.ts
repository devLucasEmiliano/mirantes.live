import { describe, expect, it } from "vitest";
import { generateMcpToken, hashToken } from "@/lib/mcp/tokens";

describe("token puro", () => {
  it("gera token com prefixo mir_ e formato esperado", () => {
    const { token, prefix } = generateMcpToken();
    expect(token.startsWith("mir_")).toBe(true);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(/^mir_[0-9A-Za-z]+$/.test(token)).toBe(true);
    expect(prefix.startsWith("mir_")).toBe(true);
    expect(prefix.endsWith("…")).toBe(true);
  });

  it("dois tokens são diferentes (entropia)", () => {
    expect(generateMcpToken().token).not.toBe(generateMcpToken().token);
  });

  it("hashToken é determinístico, sha256 hex (64), e não é o texto puro", () => {
    const { token } = generateMcpToken();
    const h = hashToken(token);
    expect(h).toBe(hashToken(token));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(token);
    expect(hashToken("mir_a")).not.toBe(hashToken("mir_b"));
  });
});
