import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const STORAGE_KEY = "af_marketing_consent_v2";
const LEGACY_STORAGE_KEYS = [
  "af_marketing_consent_v1"
];

export const MARKETING_CONSENT_EVENT =
  "af:marketing-consent";

export const MARKETING_CONSENT = {
  UNKNOWN: "unknown",
  GRANTED: "granted",
  DENIED: "denied"
};

export function getMarketingConsent() {
  try {
    const stored = JSON.parse(
      readBrowserStorage("local", STORAGE_KEY) ||
        "null"
    );

    if (
      stored?.version === 2 &&
      (
        stored?.status ===
          MARKETING_CONSENT.GRANTED ||
        stored?.status ===
          MARKETING_CONSENT.DENIED
      )
    ) {
      return stored.status;
    }
  } catch {
    // Preferimos perguntar novamente a presumir consentimento.
  }

  return MARKETING_CONSENT.UNKNOWN;
}

export function setMarketingConsent(status) {
  if (
    status !== MARKETING_CONSENT.GRANTED &&
    status !== MARKETING_CONSENT.DENIED
  ) {
    throw new Error(
      "Escolha de privacidade inválida."
    );
  }

  writeBrowserStorage(
    "local",
    STORAGE_KEY,
    JSON.stringify({
      version: 2,
      status,
      updatedAt: new Date().toISOString()
    })
  );

  for (const key of LEGACY_STORAGE_KEYS) {
    removeBrowserStorage("local", key);
  }

  window.dispatchEvent(
    new CustomEvent(
      MARKETING_CONSENT_EVENT,
      { detail: { status } }
    )
  );

  return status;
}
