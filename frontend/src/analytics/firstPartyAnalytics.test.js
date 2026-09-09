// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  firstPartyAnalyticsInternals
} from "./firstPartyAnalytics";
import {
  MARKETING_CONSENT,
  setMarketingConsent
} from "./marketingConsent";

const {
  captureAcquisition,
  route,
  uuidValido
} = firstPartyAnalyticsInternals;

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("firstPartyAnalytics", () => {
  it("mantém UTM first-party sem capturar click id antes do consentimento", () => {
    window.history.replaceState(
      {},
      "",
      "/para-profissionais?utm_source=google&utm_medium=cpc&utm_campaign=profissionais-goiania&gclid=click-123"
    );

    const acquisition = captureAcquisition();

    expect(acquisition).toMatchObject({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "profissionais-goiania",
      landingPage: "/para-profissionais"
    });
    expect(acquisition).not.toHaveProperty("gclid");
  });

  it("inclui click ids somente depois do consentimento de marketing", () => {
    setMarketingConsent(MARKETING_CONSENT.GRANTED);
    window.history.replaceState(
      {},
      "",
      "/para-profissionais?utm_source=google&utm_medium=cpc&gclid=click-123&fbclid=meta-456"
    );

    expect(captureAcquisition()).toMatchObject({
      utmSource: "google",
      utmMedium: "cpc",
      gclid: "click-123",
      fbclid: "meta-456"
    });
  });

  it.each([
    ["/negocio/studio-aurora", ["business_profile", "/negocio/:slug"]],
    ["/painel/servicos/321/editar", ["edit_service", "/painel/servicos/:id/editar"]],
    ["/servicos/unha/em/goiania", ["local_catalog", "/servicos/:categoria/em/:localidade"]],
    ["/admin/receita", ["admin", "/admin"]]
  ])("normaliza rota dinâmica sem persistir identificador bruto (%s)", (
    pathname,
    expected
  ) => {
    expect(route(pathname)).toEqual(expected);
  });

  it("mantém validação de UUID compatível com o backend", () => {
    expect(uuidValido(
      "6a9fa7d3-9c56-4b11-8e18-5f328f2b2af1"
    )).toBe(true);
    expect(uuidValido("session-123")).toBe(false);
  });
});
