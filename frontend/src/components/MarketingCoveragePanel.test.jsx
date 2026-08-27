// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingCoveragePanel } from "./MarketingCoveragePanel";

afterEach(cleanup);

describe("cobertura da mensuração", () => {
  it("apresenta as duas coberturas com meta operacional explícita", () => {
    render(
      <MarketingCoveragePanel
        items={[
          {
            label: "Cobertura de atribuição",
            value: 100,
            detail: "20 de 20 sessões"
          },
          {
            label: "Cobertura financeira",
            value: 84.6,
            detail: "11 de 13 sessões"
          }
        ]}
      />
    );

    expect(screen.getByText("Padrão operacional · 100%")).not.toBeNull();
    const attribution = screen.getByLabelText("Cobertura de atribuição: 100%");
    const financial = screen.getByLabelText("Cobertura financeira: 84,6%");

    expect(attribution.closest("article")?.className).toContain("is-success");
    expect(financial.closest("article")?.className).toContain("is-warning");
  });
});
