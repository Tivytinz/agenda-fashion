import { describe, expect, it, vi } from "vitest";
import {
  safeServiceId, onboardingAccountPath, onboardingBusinessPath,
  onboardingSchedulePath, onboardingServicePath
} from "./navigation";
import { saveStepDraft, readStepDraft, clearStepDraft } from "./stepDraft";

describe("retorno do onboarding", () => {
  it("conecta etapas com IDs de serviços salvos e mantém o plano", () => {
    expect(onboardingBusinessPath("autonoma", 9))
      .toBe("/painel/negocio?onboarding=revisao-negocio&servico_retorno=9&plano=autonoma");
    expect(onboardingAccountPath("autonoma", 9))
      .toBe("/cadastro?tipo=profissional&onboarding=revisao-conta&servico_retorno=9&plano=autonoma");
    expect(onboardingServicePath("autonoma", 9))
      .toBe("/painel/servicos/9/editar?onboarding=revisao-servico&plano=autonoma");
    expect(onboardingSchedulePath("autonoma", 9))
      .toBe("/painel/horarios?servico_retorno=9&plano=autonoma");
    expect(onboardingServicePath(null)).toBe("/painel/servicos/novo?onboarding=servico");
  });
  it("recusa IDs inválidos antes de construir links de retorno", () => {
    for (const id of ["1/editar", "0", "-4", "1e4", "999999999999999999999"]) {
      expect(safeServiceId(id)).toBeNull();
      expect(onboardingServicePath(null, id)).toBe("/painel/servicos/novo?onboarding=servico");
    }
  });
  it("preserva o rascunho da guia por no máximo 30 minutos", () => {
    const key = "test:owner:business";
    const file = new File(["a"], "capa.png", { type: "image/png" });
    saveStepDraft(key, { nome: "Manicure", cover: file });
    expect(readStepDraft(key)).toEqual({ nome: "Manicure", cover: file });
    clearStepDraft(key);
    expect(readStepDraft(key)).toBeNull();
  });
});
