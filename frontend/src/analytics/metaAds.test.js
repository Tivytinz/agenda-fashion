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
  createMetaEventContext,
  initializeMetaAds,
  resetMetaAdsForTests,
  syncMetaConsent,
  trackMetaEvent
} from "./metaAds";

vi.mock("../api/client", () => ({
  apiRequest: vi.fn()
}));

function removePixel() {
  document
    .getElementById(
      "af-meta-pixel-script"
    )
    ?.remove();
  delete window.fbq;
  delete window._fbq;
}

beforeEach(() => {
  apiRequest.mockReset();
  localStorage.clear();
  removePixel();
  resetMetaAdsForTests();
  window.history.replaceState(
    {},
    "",
    "/cadastro?utm_source=meta"
  );
});

describe("Meta Ads no navegador", () => {
  it("não carrega o Pixel antes do consentimento", async () => {
    apiRequest.mockResolvedValue({
      enabled: true,
      pixelId: "123456789"
    });

    expect(
      await initializeMetaAds()
    ).toBe(false);
    expect(
      document.getElementById(
        "af-meta-pixel-script"
      )
    ).toBeNull();
    expect(apiRequest)
      .not.toHaveBeenCalled();
  });

  it("carrega o Pixel depois do aceite e usa eventID", async () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    apiRequest.mockResolvedValue({
      enabled: true,
      pixelId: "123456789"
    });

    expect(
      await initializeMetaAds()
    ).toBe(true);

    expect(
      document.getElementById(
        "af-meta-pixel-script"
      )?.getAttribute("src")
    ).toBe(
      "https://connect.facebook.net/en_US/fbevents.js"
    );

    await trackMetaEvent(
      "CompleteRegistration",
      {},
      "af:registration:12345678"
    );

    expect(window.fbq.queue).toContainEqual([
      "track",
      "CompleteRegistration",
      {},
      {
        eventID:
          "af:registration:12345678"
      }
    ]);
  });

  it("monta contexto sem expor query string da landing", () => {
    setMarketingConsent(
      MARKETING_CONSENT.GRANTED
    );
    document.cookie =
      "_fbp=fb.1.123.456; Path=/";
    document.cookie =
      "_fbc=fb.1.123.click; Path=/";

    const contexto =
      createMetaEventContext(
        "professional-registration"
      );

    expect(contexto).toMatchObject({
      consentimento: true,
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.click",
      source_url:
        `${window.location.origin}/cadastro`
    });
    expect(contexto.event_id)
      .toMatch(
        /^af:professional-registration:[A-Za-z0-9]+$/
      );
  });

  it("sincroniza recusa sem enviar identificadores Meta", async () => {
    localStorage.setItem("token", "token-test");
    setMarketingConsent(
      MARKETING_CONSENT.DENIED
    );
    apiRequest.mockResolvedValue({
      salvo: true,
      consentimento: false
    });

    expect(
      await syncMetaConsent()
    ).toBe(true);

    expect(apiRequest)
      .toHaveBeenCalledWith(
        "/marketing/meta/consentimento",
        expect.objectContaining({
          method: "POST",
          body: {
            consentimento: false
          }
        })
      );
  });
});
