import { describe, expect, it } from "vitest";
import { MAX_AVATAR_BYTES, validateAvatar } from "@/lib/account/avatar";

describe("validateAvatar", () => {
  it("aceita PNG dentro do limite", () => {
    expect(validateAvatar({ mimeType: "image/png", size: 1024 })).toEqual({
      ok: true,
    });
  });
  it("recusa tipo não suportado", () => {
    expect(validateAvatar({ mimeType: "image/gif", size: 1024 })).toEqual({
      ok: false,
      error: "unsupported_type",
    });
  });
  it("recusa acima do tamanho máximo", () => {
    expect(
      validateAvatar({ mimeType: "image/png", size: MAX_AVATAR_BYTES + 1 }),
    ).toEqual({ ok: false, error: "too_large" });
  });
});
