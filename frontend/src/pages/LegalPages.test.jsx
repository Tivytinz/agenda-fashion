// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { PrivacyPage } from "./PrivacyPage";
import { TermsPage } from "./TermsPage";

vi.mock("../analytics/googleMeasurement", () => ({
  clearGoogleCookies: vi.fn(),
  getGoogleConfig: vi.fn().mockResolvedValue({
    enabled: true,
    measurementId: "G-ABCDEF1234"
  }),
  initializeGoogleMeasurement:
    vi.fn().mockResolvedValue(true),
  syncGoogleConsent:
    vi.fn().mockResolvedValue(true),
  updateGoogleConsent: vi.fn()
}));

vi.mock("../analytics/metaAds", () => ({
  clearMetaCookies: vi.fn(),
  getMetaConfig: vi.fn().mockResolvedValue({
    enabled: false,
    pixelId: null
  }),
  initializeMetaAds:
    vi.fn().mockResolvedValue(false),
  syncMetaConsent:
    vi.fn().mockResolvedValue(false)
}));

vi.mock("../analytics/track", () => ({
  clearMarketingAttribution: vi.fn()
}));

beforeEach(() => {
  localStorage.clear();
});

afterEach(cleanup);

describe("transparência pública", () => {
  it("publica termos com preço, renovação, cancelamento e suporte", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Termos de uso"
      })
    ).not.toBeNull();
    expect(screen.getByText(/R\$ 49,90\/mês/))
      .not.toBeNull();
    expect(screen.getByText(/nova cobrança PIX/))
      .not.toBeNull();
    expect(screen.getByText(/pode ser cancelada/))
      .not.toBeNull();
    expect(
      screen.getAllByRole("link", {
        name: "contato@agendafashion.com.br"
      })
    ).not.toHaveLength(0);
  });

  it("explica os dados Google, a revogação e a ausência de personalização", async () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Política de Privacidade e Cookies"
      })
    ).not.toBeNull();
    expect(screen.getByText(/rotas genéricas do AF/))
      .not.toBeNull();
    expect(screen.getByText(/personalização de anúncios do Google desativados/))
      .not.toBeNull();
    expect(screen.getByText(/histórico mínimo da escolha/))
      .not.toBeNull();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "Não permitir"
        })
      ).not.toBeNull();
    });
  });
});
