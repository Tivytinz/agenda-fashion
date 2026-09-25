// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  firstPartyAnalyticsInternals
} from "./firstPartyAnalytics";
import {
  MARKETING_CONSENT,
  setMarketingConsent
} from "./marketingConsent";

const {
  captureAcquisition,
  clearFirstPartyMarketingAttribution,
  flushOutbox,
  readOutbox,
  route,
  send,
  uuidValido
} = firstPartyAnalyticsInternals;

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.unstubAllGlobals();
});

describe("firstPartyAnalytics", () => {
  it("não captura origem de campanha antes do consentimento", () => {
    window.history.replaceState(
      {},
      "",
      "/para-profissionais?utm_source=google&utm_medium=cpc&utm_campaign=profissionais-goiania&gclid=click-123"
    );

    const acquisition = captureAcquisition();

    expect(acquisition).toMatchObject({
      landingPage: "/para-profissionais"
    });
    expect(acquisition).not.toHaveProperty("utmSource");
    expect(acquisition).not.toHaveProperty("utmMedium");
    expect(acquisition).not.toHaveProperty("utmCampaign");
    expect(acquisition).not.toHaveProperty("gclid");
  });

  it("inclui UTM e click ids somente depois do consentimento de marketing", () => {
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

  it("remove atribuição first-party persistida e pendente ao revogar consentimento", async () => {
    setMarketingConsent(MARKETING_CONSENT.GRANTED);
    window.history.replaceState(
      {},
      "",
      "/para-profissionais?utm_source=google&utm_medium=cpc&utm_campaign=profissionais-goiania&gclid=click-123"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })
    );

    await send([
      {
        type: "event",
        eventUuid:
          "c6b83d90-09f0-4ad2-83e3-8a1f44e92641",
        schemaVersion: 1,
        name: "profile_viewed",
        occurredAt:
          "2026-09-21T15:00:00.000Z",
        properties: {}
      }
    ]);

    expect(readOutbox()[0].payload.acquisition)
      .toMatchObject({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "profissionais-goiania",
        gclid: "click-123"
      });

    setMarketingConsent(MARKETING_CONSENT.DENIED);
    clearFirstPartyMarketingAttribution();

    expect(readOutbox()[0].payload.acquisition)
      .toMatchObject({
        landingPage: "/para-profissionais"
      });
    expect(readOutbox()[0].payload.acquisition)
      .not.toHaveProperty("utmSource");
    expect(readOutbox()[0].payload.acquisition)
      .not.toHaveProperty("gclid");

    const session = JSON.parse(
      window.sessionStorage.getItem(
        "af_analytics_session_v2"
      )
    );

    expect(session.acquisition)
      .not.toHaveProperty("utmSource");
    expect(session.acquisition)
      .not.toHaveProperty("gclid");
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

  it("mantém lote no outbox após falha transitória e reenvia depois", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        })
        .mockResolvedValue({
          ok: true,
          status: 200
        })
    );

    await send([
      {
        type: "event",
        eventUuid:
          "29e5c4ef-857e-43cf-a584-bcbd2cb0df0a",
        schemaVersion: 1,
        name: "profile_viewed",
        occurredAt:
          "2026-09-21T15:00:00.000Z",
        properties: {
          entry_point: "business_profile"
        }
      }
    ]);

    expect(readOutbox()).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    await flushOutbox();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readOutbox()).toHaveLength(0);
  });

  it("descarta lote inválido permanente para não bloquear o outbox", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400
      })
    );

    await send([
      {
        type: "event",
        eventUuid:
          "f1d5b6bf-bad7-4bd0-86ec-55a733d3f4af",
        schemaVersion: 1,
        name: "profile_viewed",
        occurredAt:
          "2026-09-21T15:00:00.000Z",
        properties: {}
      }
    ]);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readOutbox()).toHaveLength(0);
  });

  it("mantém validação de UUID compatível com o backend", () => {
    expect(uuidValido(
      "6a9fa7d3-9c56-4b11-8e18-5f328f2b2af1"
    )).toBe(true);
    expect(uuidValido("session-123")).toBe(false);
  });
});
