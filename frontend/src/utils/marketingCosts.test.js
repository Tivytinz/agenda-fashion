import { describe, expect, test } from "vitest";
import {
  campaignConversionsWithCost,
  campaignCostCoverage,
  campaignSessionsWithCost,
  formatMarketingDate,
  formatMarketingMoney,
  moneyToCents
} from "./marketingCosts";

describe("utilitários de custos de marketing", () => {
  test("converte moeda entre reais e centavos sem aceitar valores inválidos", () => {
    expect(moneyToCents("19.90")).toBe(1990);
    expect(moneyToCents("inválido")).toBeNull();
    expect(formatMarketingMoney(1990)).toContain("19,90");
  });

  test("formata a data civil sem deslocamento de fuso", () => {
    expect(formatMarketingDate("2026-09-07T23:00:00.000Z"))
      .toBe("07/09/2026");
  });

  test("limita cobertura financeira ao volume observado", () => {
    const campaign = {
      sessoes: 10,
      sessoesComCusto: 20,
      agendamentosConcluidos: 3,
      agendamentosConcluidosComCusto: 8
    };

    expect(campaignSessionsWithCost(campaign)).toBe(10);
    expect(campaignConversionsWithCost(campaign)).toBe(3);
    expect(campaignCostCoverage(campaign)).toBe(100);
  });
});
