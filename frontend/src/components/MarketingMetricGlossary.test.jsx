// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen
} from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  it
} from "vitest";
import { MarketingMetricGlossary } from "./MarketingMetricGlossary";

afterEach(cleanup);

describe("glossário de métricas de marketing", () => {
  it("explica somente os termos relevantes da tela", () => {
    render(<MarketingMetricGlossary terms={["CAC", "ROAS", "COORTE"]} />);

    fireEvent.click(screen.getByText("Entenda as métricas desta tela"));

    expect(screen.getByText(/CAC · Custo de Aquisição/i)).not.toBeNull();
    expect(screen.getByText(/ROAS · Retorno sobre investimento em anúncios/i)).not.toBeNull();
    expect(screen.getByText("Coorte")).not.toBeNull();
    expect(screen.queryByText(/CPA · Custo por aquisição/i)).toBeNull();
  });

  it("define CPS e as duas coberturas sem confundir sessão com clique", () => {
    render(<MarketingMetricGlossary terms={["CPS", "CPA", "COBERTURA"]} />);

    fireEvent.click(screen.getByText("Entenda as métricas desta tela"));

    expect(screen.getByText(/CPS · Custo por sessão/i)).not.toBeNull();
    expect(screen.getByText(/CPA · Custo por aquisição/i)).not.toBeNull();
    expect(
      screen.getByText(/Cobertura de atribuição e financeira/i)
    ).not.toBeNull();
    expect(screen.queryByText(/CPC · Custo por clique/i)).toBeNull();
  });
});
