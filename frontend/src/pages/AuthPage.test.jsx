import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./AuthPage";

describe("retorno após autenticação", () => {
  it("aceita somente caminhos internos", () => {
    expect(safeReturnPath("/minha-agenda?filtro=hoje")).toBe("/minha-agenda?filtro=hoje");
    expect(safeReturnPath("//site-malicioso.test")).toBe("");
    expect(safeReturnPath("https://site-malicioso.test")).toBe("");
    expect(safeReturnPath(null)).toBe("");
  });
});
