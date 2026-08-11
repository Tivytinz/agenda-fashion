import { apiRequest } from "../api/client";
import {
  getMarketingConsent,
  MARKETING_CONSENT
} from "./marketingConsent";

const GOOGLE_SCRIPT_ID =
  "af-google-tag-script";
const CLIENT_ID_TIMEOUT_MS = 1200;

let configPromise = null;
let initializedMeasurementId = null;
let initializedAdsId = null;
let googleJsConfigured = false;
let lastPageView = "";
let defaultConsentApplied = false;

function validMeasurementId(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  return /^G-[A-Z0-9]{6,20}$/.test(text)
    ? text
    : null;
}

function validAdsId(value) {
  const text = String(value || "")
    .trim()
    .toUpperCase();

  return /^AW-\d{5,20}$/.test(text)
    ? text
    : null;
}

function validLabel(value) {
  const text = String(value || "").trim();

  return /^[A-Za-z0-9_-]{4,100}$/.test(text)
    ? text
    : null;
}

function safeConfig(result) {
  const measurementId =
    validMeasurementId(
      result?.measurementId
    );
  const adsId =
    validAdsId(result?.adsId);

  return {
    enabled:
      result?.enabled === true &&
      Boolean(measurementId),
    measurementId,
    adsId,
    signUpLabel:
      adsId
        ? validLabel(
            result?.signUpLabel
          )
        : null,
    beginCheckoutLabel:
      adsId
        ? validLabel(
            result?.beginCheckoutLabel
          )
        : null
  };
}

export function getGoogleConfig() {
  if (!configPromise) {
    configPromise = apiRequest(
      "/marketing/google/config",
      { timeoutMs: 5000 }
    )
      .then(safeConfig)
      .catch(() => ({
        enabled: false,
        measurementId: null,
        adsId: null,
        signUpLabel: null,
        beginCheckoutLabel: null
      }));
  }

  return configPromise;
}

function ensureGtag() {
  window.dataLayer =
    window.dataLayer || [];

  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  return window.gtag;
}

function consentPayload(granted) {
  const value = granted
    ? "granted"
    : "denied";

  return {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value
  };
}

export function applyGoogleConsentDefault() {
  if (defaultConsentApplied) {
    return false;
  }

  ensureGtag()(
    "consent",
    "default",
    consentPayload(false)
  );
  defaultConsentApplied = true;
  return true;
}

export function updateGoogleConsent(status) {
  applyGoogleConsentDefault();

  const granted =
    status ===
      MARKETING_CONSENT.GRANTED;

  ensureGtag()(
    "consent",
    "update",
    consentPayload(granted)
  );

  if (!granted) {
    clearGoogleCookies();
  }

  return granted;
}

function appendGoogleScript(measurementId) {
  if (
    document.getElementById(
      GOOGLE_SCRIPT_ID
    )
  ) {
    return;
  }

  const script =
    document.createElement("script");

  script.async = true;
  script.id = GOOGLE_SCRIPT_ID;
  script.src =
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.referrerPolicy =
    "strict-origin-when-cross-origin";

  document.head.appendChild(script);
}

export async function initializeGoogleMeasurement(
  userId
) {
  applyGoogleConsentDefault();

  if (
    getMarketingConsent() !==
      MARKETING_CONSENT.GRANTED
  ) {
    return false;
  }

  const config = await getGoogleConfig();

  if (
    !config.enabled ||
    !config.measurementId
  ) {
    return false;
  }

  const gtag = ensureGtag();

  updateGoogleConsent(
    MARKETING_CONSENT.GRANTED
  );

  if (!googleJsConfigured) {
    gtag("js", new Date());
    googleJsConfigured = true;
  }

  if (
    initializedMeasurementId !==
      config.measurementId
  ) {
    gtag(
      "config",
      config.measurementId,
      {
        send_page_view: false,
        ...(userId
          ? { user_id: String(userId) }
          : {})
      }
    );
    initializedMeasurementId =
      config.measurementId;
  } else if (userId) {
    gtag(
      "set",
      "user_id",
      String(userId)
    );
  }

  if (
    config.adsId &&
    initializedAdsId !== config.adsId
  ) {
    gtag(
      "config",
      config.adsId
    );
    initializedAdsId = config.adsId;
  }

  appendGoogleScript(
    config.measurementId
  );

  return true;
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

export function clearGoogleCookies() {
  const names = new Set(
    String(document.cookie || "")
      .split(";")
      .map((chunk) =>
        chunk.trim().split("=")[0]
      )
      .filter((name) =>
        name &&
        (
          name === "_ga" ||
          name.startsWith("_ga_") ||
          name.startsWith("_gcl_")
        )
      )
  );

  for (const name of names) {
    expireCookie(name);
  }
}

export async function getGoogleClientId() {
  if (
    getMarketingConsent() !==
      MARKETING_CONSENT.GRANTED
  ) {
    return null;
  }

  const ready =
    await initializeGoogleMeasurement();

  if (!ready) {
    return null;
  }

  const config = await getGoogleConfig();

  return new Promise((resolve) => {
    let finished = false;

    const finish = (value) => {
      if (finished) {
        return;
      }

      finished = true;
      resolve(
        /^[A-Za-z0-9._-]{4,120}$/.test(
          String(value || "")
        )
          ? String(value)
          : null
      );
    };

    const timeout = window.setTimeout(
      () => finish(null),
      CLIENT_ID_TIMEOUT_MS
    );

    ensureGtag()(
      "get",
      config.measurementId,
      "client_id",
      (value) => {
        window.clearTimeout(timeout);
        finish(value);
      }
    );
  });
}

export async function syncGoogleConsent() {
  const status =
    getMarketingConsent();

  if (
    status ===
      MARKETING_CONSENT.UNKNOWN
  ) {
    applyGoogleConsentDefault();
    return false;
  }

  updateGoogleConsent(status);

  if (!localStorage.getItem("token")) {
    return false;
  }

  if (
    status ===
      MARKETING_CONSENT.DENIED
  ) {
    await apiRequest(
      "/marketing/google/consentimento",
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

  const clientId =
    await getGoogleClientId();

  await apiRequest(
    "/marketing/google/consentimento",
    {
      method: "POST",
      body: {
        consentimento: true,
        ...(clientId
          ? { client_id: clientId }
          : {})
      },
      timeoutMs: 5000
    }
  );

  return true;
}

export async function trackGooglePageView(
  pathname,
  userId
) {
  const key = String(
    pathname ||
    window.location.pathname
  );

  if (lastPageView === key) {
    return false;
  }

  const ready =
    await initializeGoogleMeasurement(
      userId
    );

  if (!ready || lastPageView === key) {
    return false;
  }

  ensureGtag()(
    "event",
    "page_view",
    {
      page_title: document.title,
      page_location:
        `${window.location.origin}${key}`
    }
  );
  lastPageView = key;

  return true;
}

async function trackAdsConversion(
  config,
  label,
  params = {}
) {
  if (
    !config.adsId ||
    !label
  ) {
    return false;
  }

  ensureGtag()(
    "event",
    "conversion",
    {
      send_to:
        `${config.adsId}/${label}`,
      ...params
    }
  );

  return true;
}

export async function trackGoogleSignUp(
  method = "email"
) {
  const ready =
    await initializeGoogleMeasurement();

  if (!ready) {
    return false;
  }

  const config = await getGoogleConfig();

  ensureGtag()(
    "event",
    "sign_up",
    { method }
  );

  await trackAdsConversion(
    config,
    config.signUpLabel
  );

  return true;
}

export async function trackGoogleBeginCheckout({
  currency = "BRL",
  value = 0,
  planId,
  planName
} = {}) {
  const ready =
    await initializeGoogleMeasurement();

  if (!ready) {
    return false;
  }

  const config = await getGoogleConfig();
  const numericValue = Number(value || 0);
  const safeValue =
    Number.isFinite(numericValue)
      ? numericValue
      : 0;

  ensureGtag()(
    "event",
    "begin_checkout",
    {
      currency,
      value: safeValue,
      items: [
        {
          item_id:
            String(planId || "plan"),
          item_name:
            String(
              planName ||
              "Plano Agenda Fashion"
            ),
          price: safeValue,
          quantity: 1
        }
      ]
    }
  );

  await trackAdsConversion(
    config,
    config.beginCheckoutLabel,
    {
      value: safeValue,
      currency
    }
  );

  return true;
}

export function resetGoogleMeasurementForTests() {
  configPromise = null;
  initializedMeasurementId = null;
  initializedAdsId = null;
  googleJsConfigured = false;
  lastPageView = "";
  defaultConsentApplied = false;
}
