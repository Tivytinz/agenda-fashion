// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarketingBarChart } from "./MarketingBarChart";

afterEach(cleanup);

describe("visualizações de marketing", () => {
  it("usa donut para distribuição de sessões por origem", () => {
    render(
      <MarketingBarChart
        title="Sessões por origem"
        description="Distribuição"
        totalFormattedValue="100"
        totalLabel="sessões"
        variant="donut"
        items={[
          { key: "google", label: "Google Ads", value: 75, formattedValue: "75 sessões" },
          { key: "meta", label: "Meta Ads", value: 25, formattedValue: "25 sessões" }
        ]}
      />
    );

    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Google Ads: 75%");
    expect(screen.getByText("sessões")).not.toBeNull();
    expect(screen.getByText("75 sessões · 75%")).not.toBeNull();
    expect(screen.getByText("25 sessões · 25%")).not.toBeNull();
  });

  it("não renderiza gráfico quando a leitura deve ficar somente em tabela", () => {
    const { container } = render(
      <MarketingBarChart
        title="ROAS por campanha"
        variant="none"
        items={[{ key: "campanha", label: "Campanha A", value: 1.4 }]}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("não desenha volume para uma série com valor zero", () => {
    const { container } = render(
      <MarketingBarChart
        title="Sessões por campanha"
        items={[
          { key: "a", label: "Campanha A", value: 10 },
          { key: "b", label: "Campanha B", value: 0 }
        ]}
      />
    );

    const bars = container.querySelectorAll(
      ".marketing-bar-chart-track > span"
    );

    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe("100%");
    expect(bars[1].style.width).toBe("0%");
  });
});
