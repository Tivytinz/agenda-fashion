// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  buildProfessionalSignupPath,
  ProfessionalLandingPage,
  PROFESSIONAL_TRACKING_PARAMS
} from "./ProfessionalLandingPage";

vi.mock("../analytics/track", () => ({
  track: vi.fn()
}));

afterEach(cleanup);

function renderLanding(path = "/para-profissionais") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfessionalLandingPage />
    </MemoryRouter>
  );
}

describe("landing para profissionais", () => {
  it("leva sempre ao cadastro profissional", () => {
    expect(buildProfessionalSignupPath(""))
      .toBe("/cadastro?tipo=profissional");
  });

  it("preserva somente parâmetros de atribuição conhecidos", () => {
    const path = buildProfessionalSignupPath(
      "?utm_source=google&utm_medium=cpc&utm_campaign=agosto&gclid=abc-123&redirect=https://malicioso.test&foo=bar"
    );
    const [, query = ""] = path.split("?");
    const params = new URLSearchParams(query);

    expect(params.get("tipo")).toBe("profissional");
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("utm_medium")).toBe("cpc");
    expect(params.get("utm_campaign")).toBe("agosto");
    expect(params.get("gclid")).toBe("abc-123");
    expect(params.has("redirect")).toBe(false);
    expect(params.has("foo")).toBe(false);
  });

  it("mantém a lista de parâmetros alinhada com a atribuição do produto", () => {
    expect(PROFESSIONAL_TRACKING_PARAMS).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "gclid",
      "fbclid"
    ]);
  });

  it("apresenta os diferenciais principais antes do cadastro", () => {
    const { container } = renderLanding();

    expect(screen.getByRole("heading", {
      level: 1,
      name:
        "Receba agendamentos sem precisar responder cada cliente."
    })).toBeTruthy();
    expect(screen.getByText("Plano grátis para começar"))
      .toBeTruthy();
    expect(screen.getAllByText("Cliente agenda sozinho"))
      .toHaveLength(2);
    expect(screen.getByText(
      "Aviso de novo agendamento pelo WhatsApp"
    )).toBeTruthy();
    expect(container.querySelector(".professional-preview-logo"))
      .toBeTruthy();
    expect(container.querySelector(".professional-benefit-icon")
      ?.textContent).toBe("📅");
    expect(container.textContent).toContain("💅");
    expect(container.textContent).toContain("🎉");
  });

  it("mantém a atribuição no CTA de criação da agenda grátis", () => {
    renderLanding(
      "/para-profissionais?utm_source=google&utm_campaign=profissionais&gclid=abc-123"
    );

    const cta = screen.getAllByRole("link", {
      name: "Criar minha agenda grátis"
    })[0];
    const href = cta.getAttribute("href");
    const [, query = ""] = href.split("?");
    const params = new URLSearchParams(query);

    expect(params.get("tipo")).toBe("profissional");
    expect(params.get("utm_source")).toBe("google");
    expect(params.get("utm_campaign"))
      .toBe("profissionais");
    expect(params.get("gclid")).toBe("abc-123");
  });

  it("explica o perfil público e os indicadores reais do dashboard", () => {
    renderLanding();

    expect(screen.getByRole("heading", {
      name:
        "Um perfil para divulgar. Um dashboard para acompanhar o negócio."
    })).toBeTruthy();
    expect(screen.getByText("Visitas ao perfil"))
      .toBeTruthy();
    expect(screen.getByText("Cliques no WhatsApp e no mapa"))
      .toBeTruthy();
    expect(screen.getByText("Serviços mais agendados"))
      .toBeTruthy();
    expect(screen.getByText(
      "Dados ilustrativos. O painel real usa os resultados do seu negócio."
    )).toBeTruthy();
  });
});
