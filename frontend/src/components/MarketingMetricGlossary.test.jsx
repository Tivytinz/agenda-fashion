// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketingMetricGlossary } from "./MarketingMetricGlossary";

describe("glossário de métricas de marketing", () => {
  it("explica somente os termos relevantes da tela", () => {
    render(<MarketingMetricGlossary terms={["CAC", "ROAS", "COORTE"]} />);

    fireEvent.click(screen.getByText("Entenda as métricas desta tela"));

    expect(screen.getByText(/CAC · Custo de Aquisição/i)).not.toBeNull();
    expect(screen.getByText(/ROAS · Retorno sobre investimento em anúncios/i)).not.toBeNull();
    expect(screen.getByText("Coorte")).not.toBeNull();
    expect(screen.queryByText(/CPA · Custo por aquisição/i)).toBeNull();
  });
});
