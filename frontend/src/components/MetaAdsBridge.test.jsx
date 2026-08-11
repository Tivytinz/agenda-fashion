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
  getMarketingConsent,
  MARKETING_CONSENT,
  setMarketingConsent
} from "../analytics/marketingConsent";
import {
  getMetaConfig,
  initializeMetaAds
} from "../analytics/metaAds";
import { MetaAdsBridge } from "./MetaAdsBridge";

vi.mock("../auth/SessionContext", () => ({
  useSession: () => ({ authenticated: true })
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
  syncMetaConsent: vi.fn().mockResolvedValue(true),
  trackMetaPageView: vi.fn().mockResolvedValue(true)
}));

beforeEach(() => {
  getMarketingConsent.mockReturnValue(
    MARKETING_CONSENT.UNKNOWN
  );
  getMetaConfig.mockResolvedValue({
    enabled: true,
    pixelId: "123456789"
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

    await user.click(
      screen.getByRole("button", { name: "Permitir" })
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
});
