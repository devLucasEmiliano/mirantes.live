import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "@/lib/github/oauth-state";

const USER = "11111111-1111-1111-1111-111111111111";
const NOW = 1_750_000_000_000;

describe("oauth-state", () => {
  it("verifica um state recém-criado e devolve o userId", () => {
    expect(verifyOAuthState(createOAuthState(USER, NOW), NOW + 1000)).toEqual({
      userId: USER,
    });
  });
  it("rejeita state expirado", () => {
    expect(
      verifyOAuthState(createOAuthState(USER, NOW), NOW + 11 * 60 * 1000),
    ).toBeNull();
  });
  it("rejeita assinatura adulterada (dentro do TTL)", () => {
    const state = createOAuthState(USER, NOW);
    expect(verifyOAuthState(`${state.slice(0, -2)}XX`, NOW + 1000)).toBeNull();
  });
  it("rejeita lixo/null", () => {
    expect(verifyOAuthState("nao-e-um-state")).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
  });
  it("dois states do mesmo user diferem (nonce)", () => {
    expect(createOAuthState(USER, NOW)).not.toBe(createOAuthState(USER, NOW));
  });
});
