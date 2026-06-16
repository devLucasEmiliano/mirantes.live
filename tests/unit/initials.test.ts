import { describe, expect, it } from "vitest";
import { deriveInitials } from "@/lib/account/initials";

describe("deriveInitials", () => {
  it("usa a 1ª letra do primeiro e do último nome", () => {
    expect(deriveInitials("Lucas Cliente")).toBe("LC");
  });
  it("nome único: duas primeiras letras", () => {
    expect(deriveInitials("Madonna")).toBe("MA");
  });
  it("colapsa espaços extras", () => {
    expect(deriveInitials("  lucas   emiliano  ")).toBe("LE");
  });
  it("vazio → '?'", () => {
    expect(deriveInitials("")).toBe("?");
  });
});
