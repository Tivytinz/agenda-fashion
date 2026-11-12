// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildBusinessMapSearchUrl, isBusinessMapUrl, timeZonesForState,
  firstMissingBusinessField, validateCreationCompleteness
} from "./form";

describe("cadastro de negócio", () => {
  it("gera uma busca no Google Maps sem presumir geolocalização certificada", () => {
    const url = buildBusinessMapSearchUrl({
      endereco: "Rua das Flores", numero: "10", bairro: "Centro", cidade: "Goiânia", estado: "GO"
    });
    expect(new URL(url).searchParams.get("query"))
      .toBe("Rua das Flores, 10, Centro, Goiânia, GO, Brasil");
    expect(isBusinessMapUrl(url)).toBe(true);
  });
  it("não aceita site comum ou domínio parecido com Google Maps", () => {
    expect(isBusinessMapUrl("https://evil.google.com.evil.test/maps")).toBe(false);
    expect(isBusinessMapUrl("https://example.com/local")).toBe(false);
    expect(isBusinessMapUrl("http://maps.google.com/")).toBe(false);
    expect(isBusinessMapUrl("https://maps.apple.com/?q=Studio")).toBe(true);
  });
  it("solicita fuso em estados ambíguos", () => {
    const form = { areas: ["Unhas"], nome: "Studio", whatsapp: "62999999999",
      cidade: "Manaus", estado: "AM", bairro: "Centro", endereco: "Rua", numero: "1",
      cep: "69000000", localizacao_url: "https://maps.google.com/", fuso_horario: "" };
    expect(timeZonesForState("AM")).toHaveLength(2);
    expect(firstMissingBusinessField(form)).toBe("fuso_horario");
    expect(validateCreationCompleteness(form)).toMatch(/Fuso horário/);
    form.fuso_horario = "America/Manaus";
    expect(validateCreationCompleteness(form)).toBe("");
  });
});
