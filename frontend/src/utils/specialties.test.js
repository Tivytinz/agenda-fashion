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
