import {
  describe,
  expect,
  it
} from "vitest";
import {
  countPaidSessionsWithoutCampaign,
  isPaidTrafficWithoutCampaign,
  managedChannelForSource
} from "./marketingAttribution";

describe("marketingAttribution", () => {
  it("detecta cpc pago sem utm_campaign sem confundir orgânico", () => {
    expect(
      isPaidTrafficWithoutCampaign({
        origem: "google",
        midia: "cpc",
        campanha: "(sem campanha)"
      })
    ).toBe(true);

    expect(
      isPaidTrafficWithoutCampaign({
        origem: "organico",
        midia: "none",
        campanha: "organico"
      })
    ).toBe(false);
  });

  it("soma apenas sessões pagas sem identidade de campanha", () => {
    expect(
      countPaidSessionsWithoutCampaign([
        {
          origem: "google",
          midia: "cpc",
          campanha: "(sem campanha)",
          sessoes: 5
        },
        {
          origem: "meta",
          midia: "cpc",
          campanha: "meta_agosto",
          sessoes: 10
        }
      ])
    ).toBe(5);
  });

  it.each([
    "paid_search",
    "paid_social",
    "paid-social",
    "social_paid",
    "display"
  ])("reconhece a mídia paga %s sem campanha", (midia) => {
    expect(
      isPaidTrafficWithoutCampaign({
        origem: "meta",
        midia,
        campanha: "(sem campanha)"
      })
    ).toBe(true);
  });

  it("normaliza origens para o canal gerenciado", () => {
    expect(managedChannelForSource("google")).toBe("google");
    expect(managedChannelForSource("facebook")).toBe("meta");
    expect(managedChannelForSource("instagram")).toBe("meta");
  });
});
