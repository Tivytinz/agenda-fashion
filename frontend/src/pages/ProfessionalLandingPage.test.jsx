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
        "Sua cliente agenda. Você atende. O AF organiza e avisa."
    })).toBeTruthy();
    expect(screen.getByText("Plano grátis para começar"))
      .toBeTruthy();
    expect(screen.getAllByText("Cliente agenda sozinho"))
      .toHaveLength(2);
    expect(screen.getByText(
      "Aviso de novo agendamento pelo WhatsApp"
    )).toBeTruthy();
    expect(screen.getByText(
      "Olá! Um novo agendamento foi realizado. ✨"
    )).toBeTruthy();
    expect(screen.getByText("Maria Oliveira"))
      .toBeTruthy();
    expect(container.querySelector(".professional-brand-inline img"))
      .toBeTruthy();
    expect(container.querySelector(".professional-whatsapp-inline-icon"))
      .toBeTruthy();
    expect(screen.getByAltText("Foto de perfil do Agenda Fashion"))
      .toBeTruthy();
    expect(container.querySelector(".professional-benefit-icon")
      ?.textContent).toBe("📅");
    expect(container.textContent).toContain("💅");
    expect(screen.getByText("Nail designer")).toBeTruthy();
    expect(screen.getByText("Lash designer")).toBeTruthy();
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

  it("mostra o fluxo real da Beauty Vanessa do perfil ao aviso", () => {
    renderLanding();

    expect(screen.getByRole("heading", {
      name:
        "Veja o Design + Henna da Beauty Vanessa sendo agendado até o aviso no WhatsApp."
    })).toBeTruthy();
    expect(screen.getAllByText("Design + Henna").length)
      .toBeGreaterThanOrEqual(2);
    expect(screen.getByText("60 min")).toBeTruthy();
    expect(screen.getByText("R$ 40,00")).toBeTruthy();
    expect(screen.getByText(
      "O AF envia o novo agendamento para a Vanessa no WhatsApp"
    )).toBeTruthy();
    expect(screen.getByRole("link", {
      name: "Testar no perfil real ↗"
    }).getAttribute("href")).toBe("/negocio/beauty-vanessa");
    expect(screen.getByText("Você divulga seu perfil"))
      .toBeTruthy();
    expect(screen.getByText("A cliente escolhe o serviço"))
      .toBeTruthy();
    expect(screen.getByText("Seleciona um horário livre"))
      .toBeTruthy();
    expect(screen.getByText("Confirma o agendamento"))
      .toBeTruthy();
    expect(document.querySelector(".professional-demo-screenshot-grid"))
      .toBeNull();
    expect(screen.queryByText("Comece em poucos passos"))
      .toBeNull();
    expect(screen.queryByText("Depois do agendamento"))
      .toBeNull();
  });
});
