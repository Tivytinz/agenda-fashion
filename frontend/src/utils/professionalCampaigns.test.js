import { describe, expect, test } from "vitest";
import {
  campaignLabel,
  campaignMediumLabel,
  campaignSourceMeta,
  formatCampaignMoney,
  isOrganicCampaign
} from "./professionalCampaigns";

describe("apresentação das campanhas profissionais", () => {
  test("reconhece a campanha canônica do Google Ads", () => {
    const campaign = {
      origem: "google",
      midia: "cpc",
      campanha: "google_ads_profissionais"
    };

    expect(campaignLabel(campaign))
      .toBe("Google Ads · Aquisição de profissionais");
    expect(campaignSourceMeta(campaign)).toEqual({
      code: "google",
      label: "Google Ads"
    });
    expect(campaignMediumLabel(campaign)).toBe("CPC");
  });

  test("não confunde origem sem evidência com orgânico", () => {
    const campaign = { classificacaoAtribuicao: "sem_evidencia" };

    expect(campaignLabel(campaign)).toBe("Origem não identificada");
    expect(isOrganicCampaign(campaign)).toBe(false);
  });

  test("formata os centavos usados na coorte financeira", () => {
    expect(formatCampaignMoney(4990)).toContain("49,90");
  });
});
