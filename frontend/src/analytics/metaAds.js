import { apiRequest } from "../api/client";
import { readBrowserStorage } from "../utils/browserStorage";
import {
  getMarketingConsent,
  MARKETING_CONSENT
} from "./marketingConsent";

const PIXEL_SCRIPT_ID =
  "af-meta-pixel-script";

let configPromise = null;
let initializedPixelId = null;
let lastPageView = "";

function safeConfig(result) {
  const pixelId = String(
    result?.pixelId || ""
  ).trim();

  return {
    enabled:
      result?.enabled === true &&
      /^\d{5,30}$/.test(pixelId),
    pixelId:
      /^\d{5,30}$/.test(pixelId)
        ? pixelId
        : null
  };
}

export function getMetaConfig() {
  if (!configPromise) {
    configPromise = apiRequest(
      "/marketing/meta/config",
      { timeoutMs: 5000 }
    )
      .then(safeConfig)
      .catch(() => ({
        enabled: false,
        pixelId: null
      }));
  }

  return configPromise;
}

function ensureFbq() {
  if (typeof window.fbq === "function") {
    return window.fbq;
  }

  const fbq = function (...args) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue.push(args);
  };

  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];

  window.fbq = fbq;
  window._fbq = fbq;

  return fbq;
}

function appendPixelScript() {
  if (
    document.getElementById(
      PIXEL_SCRIPT_ID
    )
  ) {
    return;
  }

  const script =
    document.createElement("script");

  script.async = true;
  script.id = PIXEL_SCRIPT_ID;
  script.src =
    "https://connect.facebook.net/en_US/fbevents.js";
  script.referrerPolicy =
    "strict-origin-when-cross-origin";

  document.head.appendChild(script);
}

export async function initializeMetaAds() {
  if (
    getMarketingConsent() !==
      MARKETING_CONSENT.GRANTED
  ) {
    return false;
  }

  const config = await getMetaConfig();

  if (!config.enabled || !config.pixelId) {
    return false;
  }

  const fbq = ensureFbq();

  if (
    initializedPixelId !==
    config.pixelId
  ) {
    fbq(
      "init",
      config.pixelId
    );
    initializedPixelId =
      config.pixelId;
  }

  appendPixelScript();
  return true;
}

function readCookie(name) {
  const prefix = `${name}=`;

  for (
    const chunk
    of String(document.cookie || "")
      .split(";")
  ) {
    const item = chunk.trim();

    if (item.startsWith(prefix)) {
      return decodeURIComponent(
        item.slice(prefix.length)
      );
    }
  }

  return null;
}

function expireCookie(name) {
  document.cookie =
    `${name}=; Max-Age=0; Path=/; SameSite=Lax`;

  const hostname =
    window.location.hostname;

  if (hostname.includes(".")) {
    document.cookie =
      `${name}=; Max-Age=0; Path=/; Domain=.${hostname}; SameSite=Lax`;
  }
}

export function clearMetaCookies() {
  expireCookie("_fbp");
  expireCookie("_fbc");
}

function safeNamespace(value) {
  return String(value || "event")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "event";
}

function uniquePart() {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.();

  if (uuid) {
    return uuid.replaceAll("-", "");
  }

  return `${Date.now()}${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function createMetaEventContext(
  namespace
) {
  const consent =
    getMarketingConsent();

  if (
    consent ===
      MARKETING_CONSENT.UNKNOWN
  ) {
    return null;
  }

  if (
    consent ===
      MARKETING_CONSENT.DENIED
  ) {
    return {
      consentimento: false
    };
  }

  return {
    consentimento: true,
    event_id:
      `af:${safeNamespace(namespace)}:${uniquePart()}`,
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
    source_url:
      `${window.location.origin}${window.location.pathname}`
  };
}

export async function trackMetaEvent(
  eventName,
  customData = {},
  eventId
) {
  if (!eventId) {
    return false;
  }

  const ready =
    await initializeMetaAds();

  if (!ready) {
    return false;
  }

  window.fbq(
    "track",
    eventName,
    customData,
    { eventID: eventId }
  );

  return true;
}

export async function trackMetaPageView(
  pathname
) {
  const key = String(
    pathname ||
    window.location.pathname
  );

  if (lastPageView === key) {
    return false;
  }

  const ready =
    await initializeMetaAds();

  if (!ready) {
    return false;
  }

  if (lastPageView === key) {
    return false;
  }

  window.fbq(
    "track",
    "PageView"
  );
  lastPageView = key;

  return true;
}

export async function syncMetaConsent() {
  const status =
    getMarketingConsent();

  if (
    status ===
      MARKETING_CONSENT.UNKNOWN
  ) {
    return false;
  }

  if (!readBrowserStorage("local", "token")) {
    if (
      status ===
        MARKETING_CONSENT.DENIED
    ) {
      clearMetaCookies();
    }

    return false;
  }

  if (
    status ===
      MARKETING_CONSENT.DENIED
  ) {
    clearMetaCookies();

    await apiRequest(
      "/marketing/meta/consentimento",
      {
        method: "POST",
        body: {
          consentimento: false
        },
        timeoutMs: 5000
      }
    );

    return true;
  }

  await initializeMetaAds();

  await apiRequest(
    "/marketing/meta/consentimento",
    {
      method: "POST",
      body: {
        consentimento: true,
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc")
      },
      timeoutMs: 5000
    }
  );

  return true;
}

export function resetMetaAdsForTests() {
  configPromise = null;
  initializedPixelId = null;
  lastPageView = "";
}
