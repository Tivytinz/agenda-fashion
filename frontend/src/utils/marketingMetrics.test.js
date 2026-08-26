import {
  describe,
  expect,
  it
} from "vitest";
import {
  formatMetricPercent,
  metricPercentage,
  paidAttributionQuality
} from "./marketingMetrics";

describe("marketingMetrics", () => {
  it("não inventa percentual quando não existe denominador", () => {
    expect(metricPercentage(0, 0)).toBeNull();
    expect(formatMetricPercent(null)).toBe("Sem base");
  });

  it("calcula cobertura somente sobre o tráfego pago detectado", () => {
    expect(
      paidAttributionQuality({
        official: 13,
        missingCampaign: 6,
        unofficialIdentity: 1
      })
    ).toEqual({
      officialSessions: 13,
      pendingSessions: 7,
      detectedPaidSessions: 20,
      coverage: 65
    });
  });
});
