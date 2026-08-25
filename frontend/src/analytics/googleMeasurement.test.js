// @vitest-environment jsdom

import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { apiRequest } from "../api/client";
import {
  MARKETING_CONSENT,
  setMarketingConsent
} from "./marketingConsent";
import {
  hasPendingGoogleConsentSync,
  applyGoogleConsentDefault,
  googleCookieDomainCandidates,
  initializeGoogleMeasurement,
  resetGoogleMeasurementForTests,
  sanitizeGooglePagePath,
  syncGoogleConsent,
  trackGoogleBeginCheckout,
  trackGooglePageView,
  trackGoogleSignUp
} from "./googleMeasurement";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function clearGoogle() {
  document
    .getElementById(
      "af-google-tag-script"
    )
    ?.remove();
  delete window.gtag;
  delete window.dataLayer;
}

function queue() {
  return (window.dataLayer || [])
    .map((args) => Array.from(args));
}

function enabledConfig() {
  return {
    enabled: true,
    measurementId: "G-ABCDEF1234",
    adsId: "AW-123456789",
    signUpLabel: "signupLabel1",
    beginCheckoutLabel:
      "checkoutLabel1"
  };
}

beforeEach(() => {
  apiRequest.mockReset();
  localStorage.clear();
  clearGoogle();
  resetGoogleMeasurementForTests();
  window.history.replaceState({}, "", "/");
});

describe("Google Measurement no navegador", () => {
  it("inclui o domínio pai ao revogar cookies Google", () => {
    expect(
      googleCookieDomainCandidates(
        "app.agendafashion.com.br"
      )
    ).toEqual([
      "app.agendafashion.com.br",
      "agendafashion.com.br"
    ]);
    expect(
      googleCookieDomainCandidates("localhost")
    ).toEqual([]);
  });

  it("aplica Consent Mode negado sem carregar a tag", () => {
    expect(
      applyGoogleConsentDefault()
    ).toBe(true);

    expect(queue()).toContainEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
      }
    ]);
    expect(
      document.getElementById(
        "af-google-tag-script"
      )
    ).toBeNull();
  });

  it("não carrega GA4 antes do consentimento", async () => {
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    expect(
      await initializeGoogleMeasurement()
    ).toBe(false);
    expect(apiRequest)
      .not.toHaveBeenCalled();
    expect(
      document.getElementById(
        "af-google-tag-script"
      )
    ).toBeNull();
  });

  it("carrega GA4 depois do aceite com page view automático desativado", async () => {
    window.history.replaceState(
      {},
      "",
      "/redefinir-senha?token=nao-enviar&email=pessoa@example.com"
    );
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    expect(
      await initializeGoogleMeasurement(77)
    ).toBe(true);

    expect(
      document.getElementById(
        "af-google-tag-script"
      )?.getAttribute("src")
    ).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABCDEF1234"
    );
    expect(queue()).toContainEqual([
      "config",
      "G-ABCDEF1234",
      {
        send_page_view: false,
        user_id: "77",
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location:
          `${window.location.origin}/redefinir-senha`,
        page_title: "Agenda Fashion",
        page_referrer: ""
      }
    ]);
    expect(queue()).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "denied"
      }
    ]);
    expect(JSON.stringify(queue()))
      .not.toContain("nao-enviar");
    expect(JSON.stringify(queue()))
      .not.toContain("pessoa@example.com");
  });

  it("remove query strings e anonimiza rotas dinâmicas antes de enviar page_view", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    const firstPath =
      "/redefinir-senha?token=segredo-reset&email=pessoa@example.com";
    const secondPath =
      "/redefinir-senha?token=outro-segredo";
    const profilePath =
      "/negocio/victor-souza?busca=62999999999";

    expect(
      await trackGooglePageView(firstPath)
    ).toBe(true);
    expect(
      await trackGooglePageView(firstPath)
    ).toBe(false);
    expect(
      await trackGooglePageView(secondPath)
    ).toBe(false);
    expect(
      await trackGooglePageView(profilePath)
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "page_view",
      {
        page_title: "Agenda Fashion",
        page_location:
          `${window.location.origin}/redefinir-senha`,
        page_referrer: ""
      }
    ]);
    expect(queue()).toContainEqual([
      "event",
      "page_view",
      {
        page_title:
          "Perfil profissional | Agenda Fashion",
        page_location:
          `${window.location.origin}/negocio/:slug`,
        page_referrer: ""
      }
    ]);
    expect(JSON.stringify(queue()))
      .not.toContain("segredo-reset");
    expect(JSON.stringify(queue()))
      .not.toContain("pessoa@example.com");
    expect(JSON.stringify(queue()))
      .not.toContain("62999999999");
    expect(
      sanitizeGooglePagePath(
        "/rota/pessoa@example.com?telefone=62999999999"
      )
    ).toBe("/pagina");
  });

  it("envia sign_up e conversão Google Ads quando o label existe", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    expect(
      await trackGoogleSignUp(
        "email",
        "af-signup-77"
      )
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "sign_up",
      {
        page_location:
          `${window.location.origin}/`,
        page_title: "Agenda Fashion",
        page_referrer: "",
        method: "email",
        transaction_id: "af-signup-77"
      }
    ]);
    expect(queue()).toContainEqual([
      "event",
      "conversion",
      {
        send_to:
          "AW-123456789/signupLabel1",
        page_location:
          `${window.location.origin}/`,
        page_title: "Agenda Fashion",
        page_referrer: "",
        transaction_id: "af-signup-77"
      }
    ]);
  });

  it("envia begin_checkout com valor e item do plano", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    expect(
      await trackGoogleBeginCheckout({
        currency: "BRL",
        value: 49.9,
        planId: "pro",
        planName: "Plano Pro",
        transactionId:
          "checkout-12345678"
      })
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "begin_checkout",
      {
        page_location:
          `${window.location.origin}/`,
        page_title: "Agenda Fashion",
        page_referrer: "",
        currency: "BRL",
        value: 49.9,
        transaction_id:
          "checkout-12345678",
        items: [
          {
            item_id: "pro",
            item_name: "Plano Pro",
            price: 49.9,
            quantity: 1
          }
        ]
      }
    ]);
    expect(queue()).toContainEqual([
      "event",
      "conversion",
      {
        send_to:
          "AW-123456789/checkoutLabel1",
        page_location:
          `${window.location.origin}/`,
        page_title: "Agenda Fashion",
        page_referrer: "",
        value: 49.9,
        currency: "BRL",
        transaction_id:
          "checkout-12345678"
      }
    ]);
  });

  it("sincroniza recusa sem enviar client id", async () => {
    localStorage.setItem(
      "session_active",
      "1"
    );
    setMarketingConsent(
      MARKETING_CONSENT.DENIED
    );
    apiRequest.mockResolvedValue({
      salvo: true,
      consentimento: false
    });

    expect(
      await syncGoogleConsent()
    ).toBe(true);

    expect(apiRequest)
      .toHaveBeenCalledWith(
        "/marketing/google/consentimento",
        expect.objectContaining({
          method: "POST",
          body: {
            consentimento: false,
            origem: "NAVEGADOR",
            texto_versao: "2026-08-25"
          }
        })
      );
    expect(hasPendingGoogleConsentSync())
      .toBe(false);
  });

  it("mantém revogação pendente para nova tentativa quando a rede falha", async () => {
    localStorage.setItem("session_active", "1");
    setMarketingConsent(MARKETING_CONSENT.DENIED);
    apiRequest.mockRejectedValue(
      new Error("sem conexão")
    );

    await expect(syncGoogleConsent())
      .rejects.toThrow("sem conexão");
    expect(hasPendingGoogleConsentSync())
      .toBe(true);
  });
});
