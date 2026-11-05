import { describe, expect, it } from "vitest";
import { buildProfessionalLoginPath, buildProfessionalSignupPath, getProfessionalEntry } from "./professionalEntry";
describe("entrada profissional", () => {
  it("leva visitantes diretamente ao cadastro e preserva somente atribuição conhecida", () => {
    expect(buildProfessionalSignupPath("?utm_source=google&busca=unhas&redirect=https://externo.test"))
      .toBe("/cadastro?tipo=profissional&utm_source=google");
    expect(buildProfessionalLoginPath("?utm_source=google"))
      .toBe("/entrar?tipo=profissional&utm_source=google");
  });
  it("reutiliza uma conta autenticada sem negócio", () => {
    expect(getProfessionalEntry({ authenticated: true }).path).toBe("/criar-negocio");
  });
  it("preserva o contexto de dona ou profissional", () => {
    expect(getProfessionalEntry({ authenticated: true, negocio: { papel: "dono" } }).path).toBe("/painel");
    expect(getProfessionalEntry({ authenticated: true, negocio: { papel: "profissional" } }).path).toBe("/profissional/agenda");
  });
});
