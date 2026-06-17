import { describe, expect, it } from "vitest";
import { eventDateGroup, eventTime } from "@/lib/events/format";

// Datas construídas no fuso LOCAL (year, monthIndex, day, h, m) → estáveis em qualquer TZ.
describe("eventTime", () => {
  it("HH:MM 24h com zero à esquerda", () => {
    expect(eventTime(new Date(2026, 5, 11, 14, 32))).toBe("14:32");
    expect(eventTime(new Date(2026, 5, 11, 9, 5))).toBe("09:05");
  });
});

describe("eventDateGroup", () => {
  const now = new Date(2026, 5, 11, 18, 0);
  it("mesmo dia → Hoje", () =>
    expect(eventDateGroup(new Date(2026, 5, 11, 9, 0), now)).toBe(
      "Hoje — 11 Jun 2026",
    ));
  it("dia anterior → Ontem", () =>
    expect(eventDateGroup(new Date(2026, 5, 10, 23, 0), now)).toMatch(
      /^Ontem — 10 Jun 2026$/,
    ));
  it("mais antigo → só a data", () => {
    const g = eventDateGroup(new Date(2026, 5, 3, 9, 0), now);
    expect(g).toBe("3 Jun 2026");
    expect(g).not.toMatch(/Hoje|Ontem/);
  });
});
