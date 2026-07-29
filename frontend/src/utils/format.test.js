import { describe, expect, test } from "vitest";
import {
  formatCurrency,
  formatLocation,
  formatRating,
  normalizeAvailability,
  normalizeText
} from "./format";

describe("formatadores do frontend", () => {
  test("normaliza acentos para a busca", () => {
    expect(normalizeText("Cílios e Sobrancelhas")).toBe("cilios e sobrancelhas");
  });

  test("formata valores em reais", () => {
    expect(formatCurrency(35)).toContain("35,00");
  });

  test("monta a localização sem campos vazios", () => {
    expect(formatLocation({ bairro: "Centro", cidade: "Goiânia", estado: "GO" }))
      .toBe("Centro, Goiânia, GO");
  });

  test("remove localização repetida ou inválida", () => {
    expect(formatLocation({ bairro: "Centro", cidade: " centro ", estado: null }))
      .toBe("Centro");
  });

  test("mostra Novo quando ainda não há avaliações", () => {
    expect(formatRating({ total_avaliacoes: 0 }).label).toBe("Novo");
    expect(formatRating({ total_avaliacoes: 2, media_avaliacoes: 4.5 }).label)
      .toBe("★ 4.5");
  });

  test("mantém somente dias que possuem horários válidos", () => {
    expect(normalizeAvailability([
      { data: "2026-07-30", horarios: [] },
      { data: "2026-07-31", horarios: ["10:00:00", "09:00", "10:00"] },
      { data: "2026-07-31", horarios: ["11:00"] }
    ])).toEqual([
      { data: "2026-07-31", horarios: ["09:00", "10:00", "11:00"] }
    ]);
  });
});
