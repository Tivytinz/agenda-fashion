// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import {
  cleanup,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  getGoogleConfig,
  initializeGoogleMeasurement,
  syncGoogleConsent,
  trackGooglePageView,
  updateGoogleConsent
} from "../analytics/googleMeasurement";
import {
  getMarketingConsent,
  MARKETING_CONSENT,
  setMarketingConsent
} from "../analytics/marketingConsent";
import {
  getMetaConfig,
  initializeMetaAds,
  revokeMetaConsent
} from "../analytics/metaAds";
import {
  isAdminMeasurementRoute,
  MetaAdsBridge
} from "./MetaAdsBridge";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({
    authenticated: true,
    usuario: { id: 9 }
  })
}));

vi.mock("../analytics/marketingConsent", () => ({
  getMarketingConsent: vi.fn(),
  MARKETING_CONSENT: {
    UNKNOWN: "unknown",
    GRANTED: "granted",
    DENIED: "denied"
  },
  MARKETING_CONSENT_EVENT: "af:marketing-consent",
  setMarketingConsent: vi.fn()
}));

vi.mock("../analytics/metaAds", () => ({
  clearMetaCookies: vi.fn(),
  getMetaConfig: vi.fn(),
  initializeMetaAds: vi.fn(),
  revokeMetaConsent: vi.fn(),
  syncMetaConsent: vi.fn().mockResolvedValue(true),
  trackMetaPageView: vi.fn().mockResolvedValue(true)
}));

vi.mock("../analytics/googleMeasurement", () => ({
  applyGoogleConsentDefault: vi.fn(),
  getGoogleConfig: vi.fn(),
  hasPendingGoogleConsentSync:
    vi.fn().mockReturnValue(false),
  initializeGoogleMeasurement:
    vi.fn().mockResolvedValue(true),
  syncGoogleConsent:
    vi.fn().mockResolvedValue(true),
  trackGooglePageView:
    vi.fn().mockResolvedValue(true),
  updateGoogleConsent: vi.fn()
}));

vi.mock("../analytics/track", () => ({
  clearMarketingAttribution: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
  getMarketingConsent.mockReturnValue(
    MARKETING_CONSENT.UNKNOWN
  );
  getMetaConfig.mockResolvedValue({
    enabled: true,
    pixelId: "123456789"
  });
  getGoogleConfig.mockResolvedValue({
    enabled: false,
    measurementId: null,
    adsId: null
  });
  initializeMetaAds.mockResolvedValue(true);
  setMarketingConsent.mockReset();
});

afterEach(cleanup);

describe("consentimento de marketing", () => {
  it("mantém texto e ações em blocos próprios e salva a escolha", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <MetaAdsBridge />
      </MemoryRouter>
    );

    const region = await screen.findByRole(
      "complementary",
      { name: "Preferências de privacidade" }
    );
    const actions = screen.getByRole(
      "group",
      { name: "Escolha de medição de anúncios" }
    );

    expect(
      region.querySelector(".marketing-consent-copy")
    ).not.toBeNull();
    expect(actions.querySelectorAll("button"))
      .toHaveLength(2);
    expect(region.textContent)
      .toContain("Google Analytics, Google Ads e Meta");

    await user.click(
      screen.getByRole("button", { name: "Permitir medição" })
    );

    expect(setMarketingConsent)
      .toHaveBeenCalledWith(MARKETING_CONSENT.GRANTED);
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Privacidade" })
      ).not.toBeNull();
    });
  });

  it("protege o layout de 320 a 800 px contra estouro horizontal", () => {
    const cssPath = resolve(
      cwd(),
      "src/styles/marketing-consent.css"
    );
    const css = readFileSync(cssPath, "utf8");

    expect(css).toContain("@media (max-width: 800px)");
    expect(css).toContain("flex-direction: column");
    expect(css).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(css).toContain("width: auto");
    expect(css).toContain("min-width: 0");
  });

  it("revoga o Pixel mesmo quando apenas a medição do Google está ativa", async () => {
    getMarketingConsent.mockReturnValue(
      MARKETING_CONSENT.DENIED
    );
    getMetaConfig.mockResolvedValue({
      enabled: false,
      pixelId: null
    });
    getGoogleConfig.mockResolvedValue({
      enabled: true,
      measurementId:
        "G-123456789",
      adsId: null
    });

    render(
      <MemoryRouter>
        <MetaAdsBridge />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(revokeMetaConsent)
        .toHaveBeenCalled();
    });
  });

  it("sincroniza uma recusa histórica mesmo com Google desativado", async () => {
    getMarketingConsent.mockReturnValue(
      MARKETING_CONSENT.DENIED
    );
    getMetaConfig.mockResolvedValue({
      enabled: false,
      pixelId: null
    });
    getGoogleConfig.mockResolvedValue({
      enabled: false,
      measurementId: null,
      adsId: null
    });

    render(
      <MemoryRouter>
        <MetaAdsBridge />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(syncGoogleConsent)
        .toHaveBeenCalled();
    });
  });

  it("classifica qualquer rota administrativa como interna", () => {
    expect(isAdminMeasurementRoute("/admin"))
      .toBe(true);
    expect(isAdminMeasurementRoute("/admin/saude"))
      .toBe(true);
    expect(
      isAdminMeasurementRoute("/admin/nova-funcionalidade")
    ).toBe(true);
    expect(isAdminMeasurementRoute("/painel"))
      .toBe(false);
  });

  it("não inicializa nem envia page_view do Google em rota administrativa", async () => {
    getMarketingConsent.mockReturnValue(
      MARKETING_CONSENT.GRANTED
    );
    getMetaConfig.mockResolvedValue({
      enabled: false,
      pixelId: null
    });
    getGoogleConfig.mockResolvedValue({
      enabled: true,
      measurementId: "G-123456789",
      adsId: "AW-123456789"
    });

    render(
      <MemoryRouter
        initialEntries={["/admin/nova-funcionalidade"]}
      >
        <MetaAdsBridge />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(updateGoogleConsent)
        .toHaveBeenCalledWith(MARKETING_CONSENT.DENIED);
    });

    expect(initializeGoogleMeasurement)
      .not.toHaveBeenCalled();
    expect(trackGooglePageView)
      .not.toHaveBeenCalled();
  });
});
