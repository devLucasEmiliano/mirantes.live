import { describe, expect, it } from "vitest";
import {
  MIN_INTERVAL_MS,
  resolveSyncInterval,
  shouldAutostart,
} from "@/lib/github/worker";

describe("resolveSyncInterval", () => {
  it("ausente → usa o fallback (default 60s)", () => {
    expect(resolveSyncInterval(undefined, 60_000)).toBe(60_000);
  });
  it("valor válido acima do piso → respeita", () => {
    expect(resolveSyncInterval(120_000, 60_000)).toBe(120_000);
  });
  it("abaixo do piso → clampa no piso (segurança de rate limit)", () => {
    expect(resolveSyncInterval(5_000, 60_000)).toBe(MIN_INTERVAL_MS);
    expect(MIN_INTERVAL_MS).toBe(15_000);
  });
  it("não-positivo / NaN → cai no fallback", () => {
    expect(resolveSyncInterval(0, 60_000)).toBe(60_000);
    expect(resolveSyncInterval(-1, 60_000)).toBe(60_000);
    expect(resolveSyncInterval(Number.NaN, 60_000)).toBe(60_000);
  });
});

describe("shouldAutostart", () => {
  it("nodejs + '1' → liga", () => {
    expect(shouldAutostart("nodejs", "1")).toBe(true);
  });
  it("edge + '1' → não liga (Prisma/sockets não vão no Edge)", () => {
    expect(shouldAutostart("edge", "1")).toBe(false);
  });
  it("runtime indefinido → não liga", () => {
    expect(shouldAutostart(undefined, "1")).toBe(false);
  });
  it("nodejs + '0' → desligado (e2e/standalone)", () => {
    expect(shouldAutostart("nodejs", "0")).toBe(false);
  });
});
