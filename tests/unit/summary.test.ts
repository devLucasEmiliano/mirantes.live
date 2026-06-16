import { describe, expect, it } from "vitest";
import { formatWeeklyDelta } from "@/lib/github/map";

describe("formatWeeklyDelta", () => {
  it("sem base e sem commits", () =>
    expect(formatWeeklyDelta(0, 0)).toBe("sem commits ainda"));
  it("semana anterior zero, com commits agora → +100%", () =>
    expect(formatWeeklyDelta(5, 0)).toBe("+100% vs semana anterior"));
  it("crescimento", () =>
    expect(formatWeeklyDelta(11, 10)).toBe("+10% vs semana anterior"));
  it("queda", () =>
    expect(formatWeeklyDelta(8, 10)).toBe("-20% vs semana anterior"));
});
