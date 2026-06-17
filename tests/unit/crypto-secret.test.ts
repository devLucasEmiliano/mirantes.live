import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret";

function flip(b64: string): string {
  return (b64[0] === "A" ? "B" : "A") + b64.slice(1);
}

describe("encryptSecret/decryptSecret", () => {
  it("round-trip de um token gho_", () => {
    const plain = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
    const enc = encryptSecret(plain);
    expect(enc.ciphertext).not.toBe(plain);
    expect(decryptSecret(enc)).toBe(plain);
  });
  it("round-trip de unicode", () => {
    const plain = "tökèn—çãó-🔐";
    expect(decryptSecret(encryptSecret(plain))).toBe(plain);
  });
  it("gera IV/ciphertext distintos a cada encrypt (nonce GCM não reusa)", () => {
    const a = encryptSecret("mesmo-texto");
    const b = encryptSecret("mesmo-texto");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
  it("lança ao adulterar o ciphertext", () => {
    const enc = encryptSecret("segredo");
    expect(() =>
      decryptSecret({ ...enc, ciphertext: flip(enc.ciphertext) }),
    ).toThrow();
  });
  it("lança ao adulterar o authTag", () => {
    const enc = encryptSecret("segredo");
    expect(() =>
      decryptSecret({ ...enc, authTag: flip(enc.authTag) }),
    ).toThrow();
  });
  it("lança ao adulterar o iv", () => {
    const enc = encryptSecret("segredo");
    expect(() => decryptSecret({ ...enc, iv: flip(enc.iv) })).toThrow();
  });
});
