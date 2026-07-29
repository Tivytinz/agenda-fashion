import { describe, expect, it } from "vitest";
import { planFeatures } from "./plans";

describe("planFeatures", () => {
  it("usa singular e plural naturais", () => {
    expect(planFeatures({
      capacidade_agendamentos: 1,
      limite_profissionais: 1,
      limite_servicos: 2
    })).toEqual([
      "1 agendamento/mês",
      "1 profissional",
      "2 serviços",
      "WhatsApp Business incluído"
    ]);
  });

  it("descreve limites ilimitados", () => {
    expect(planFeatures({
      capacidade_agendamentos: null,
      limite_profissionais: null,
      limite_servicos: null
    })).toEqual([
      "Agendamentos ilimitados",
      "Profissionais ilimitados",
      "Serviços ilimitados",
      "WhatsApp Business incluído"
    ]);
  });
});
