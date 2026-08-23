import { describe, expect, it } from "vitest";
import {
  BUSINESS_SPECIALTIES,
  normalizeBusinessSpecialties,
  serviceCategoryEmoji,
  serviceCategoryLabel
} from "./specialties";

describe("categoria de Bronzeamento", () => {
  it("mantém rótulo, ícone e especialidade consistentes", () => {
    expect(serviceCategoryLabel("bronzeamento"))
      .toBe("Bronzeamento");
    expect(serviceCategoryEmoji("bronzeamento"))
      .toBe("☀️");
    expect(normalizeBusinessSpecialties({
      areas: ["bronze natural"]
    })).toEqual(["Bronzeamento"]);
    expect(BUSINESS_SPECIALTIES).toContainEqual([
      "Bronzeamento",
      "Bronzeamento"
    ]);
  });
});

describe("ícones de Cílios e Sobrancelhas", () => {
  it("mantém fallbacks visualmente distintos", () => {
    expect(serviceCategoryEmoji("cilio"))
      .toBe("👁️");
    expect(serviceCategoryEmoji("sobrancelha"))
      .toBe("〰️");
    expect(serviceCategoryEmoji("", "Design com henna"))
      .toBe("〰️");
    expect(serviceCategoryEmoji("", "Extensão de lashes"))
      .toBe("👁️");
  });
});
