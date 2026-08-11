import { describe, expect, it } from "vitest";
import { safeReturnPath, WHATSAPP_PATTERN } from "./AuthPage";

describe("retorno após autenticação", () => {
  it("aceita somente caminhos internos", () => {
    expect(safeReturnPath("/minha-agenda?filtro=hoje")).toBe("/minha-agenda?filtro=hoje");
    expect(safeReturnPath("//site-malicioso.test")).toBe("");
    expect(safeReturnPath("https://site-malicioso.test")).toBe("");
    expect(safeReturnPath(null)).toBe("");
  });
});

describe("validação de WhatsApp", () => {
  const regex = new RegExp(`^(?:${WHATSAPP_PATTERN})$`);

  it("aceita números brasileiros com 10 ou 11 dígitos", () => {
    expect(regex.test("62999332133")).toBe(true);
    expect(regex.test("6233322133")).toBe(true);
    expect(regex.test("(62) 99933-2133")).toBe(true);
  });

  it("rejeita quantidades inválidas de dígitos", () => {
    expect(regex.test("629933213")).toBe(false);
    expect(regex.test("55629993322133")).toBe(false);
  });
});
