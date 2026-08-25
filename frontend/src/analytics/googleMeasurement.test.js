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
  applyGoogleConsentDefault,
  initializeGoogleMeasurement,
  resetGoogleMeasurementForTests,
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
});

describe("Google Measurement no navegador", () => {
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
        user_id: "77"
      }
    ]);
  });

  it("preserva gclid e UTMs no page_location e diferencia query strings", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    const firstPath =
      "/para-pro?gclid=abc123&utm_source=google&utm_medium=cpc&utm_campaign=profissionais";
    const secondPath =
      "/para-pro?gclid=xyz987&utm_source=google&utm_medium=cpc&utm_campaign=profissionais";

    expect(
      await trackGooglePageView(firstPath)
    ).toBe(true);
    expect(
      await trackGooglePageView(firstPath)
    ).toBe(false);
    expect(
      await trackGooglePageView(secondPath)
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "page_view",
      {
        page_title: document.title,
        page_location:
          `${window.location.origin}${firstPath}`
      }
    ]);
    expect(queue()).toContainEqual([
      "event",
      "page_view",
      {
        page_title: document.title,
        page_location:
          `${window.location.origin}${secondPath}`
      }
    ]);
  });

  it("envia sign_up e conversão Google Ads quando o label existe", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue(
      enabledConfig()
    );

    expect(
      await trackGoogleSignUp("email")
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "sign_up",
      { method: "email" }
    ]);
    expect(queue()).toContainEqual([
      "event",
      "conversion",
      {
        send_to:
          "AW-123456789/signupLabel1"
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
        planName: "Plano Pro"
      })
    ).toBe(true);

    expect(queue()).toContainEqual([
      "event",
      "begin_checkout",
      {
        currency: "BRL",
        value: 49.9,
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
        value: 49.9,
        currency: "BRL"
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
            consentimento: false
          }
        })
      );
  });
});
