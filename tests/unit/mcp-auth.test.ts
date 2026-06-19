import { describe, expect, it } from "vitest";
import { resolveScopeFromToken } from "@/lib/mcp/auth";

// vitest.config.ts test.env: MCP_SERVICE_TOKEN = "test-mcp-token-aaaaaaaa"
describe("resolveScopeFromToken", () => {
  it("token válido → escopo admin", () =>
    expect(resolveScopeFromToken("test-mcp-token-aaaaaaaa")).toEqual({
      role: "admin",
    }));
  it("token errado → null", () =>
    expect(resolveScopeFromToken("nope")).toBeNull());
  it("ausente → null", () =>
    expect(resolveScopeFromToken(undefined)).toBeNull());
});
