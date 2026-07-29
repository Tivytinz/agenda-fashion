import { describe, expect, it } from "vitest";
import { getWorkspacePath } from "./session";

describe("destino da sessão", () => {
  it("leva contas sem negócio para o onboarding", () => {
    expect(getWorkspacePath({ temNegocio: false })).toBe("/criar-negocio");
  });

  it("leva a dona ao painel", () => {
    expect(getWorkspacePath({
      temNegocio: true,
      negocio: { papel: "dono" }
    })).toBe("/painel");
  });

  it("leva a profissional à própria agenda", () => {
    expect(getWorkspacePath({
      temNegocio: true,
      negocio: { papel: "profissional" }
    })).toBe("/profissional/agenda");
  });
});
