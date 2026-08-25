import { apiRequest } from "../api/client";
import { hasSession } from "../auth/session";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";
import {
  getMarketingConsent,
  getMarketingConsentRecord,
  MARKETING_CONSENT
} from "./marketingConsent";

const GOOGLE_SCRIPT_ID =
  "af-google-tag-script";
const CLIENT_ID_TIMEOUT_MS = 1200;
const GOOGLE_CONSENT_SYNC_KEY =
  "af_google_consent_sync_pending_v1";
const GOOGLE_CONSENT_SOURCE =
  "NAVEGADOR";

const SAFE_STATIC_PAGE_PATHS = new Set([
  "/",
  "/para-profissionais",
  "/planos",
  "/privacidade",
  "/termos",
  "/entrar",
  "/cadastro",
  "/esqueci-senha",
  "/redefinir-senha",
  "/confirmar",
  "/sucesso",
  "/minha-agenda",
  "/favoritos",
  "/criar-negocio",
  "/conta",
  "/checkout",
  "/painel",
  "/painel/agenda",
  "/painel/servicos",
  "/painel/servicos/novo",
  "/painel/profissionais",
  "/painel/horarios",
  "/painel/negocio",
  "/painel/assinatura",
  "/profissional/agenda",
  "/profissional/horarios",
  "/admin/trafego-pago",
  "/admin/trafego-pago/custos",
  "/admin/trafego-pago/profissionais",
  "/admin/saude",
  "/admin/whatsapp"
]);

let configPromise = null;
let initializedMeasurementId = null;
let initializedAdsId = null;
let currentUserId = null;
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

function pathnameFrom(value) {
  try {
    const fallbackOrigin =
      window.location.origin ||
      "https://app.agendafashion.com.br";
    const parsed = new URL(
      String(value || window.location.pathname),
      fallbackOrigin
    );

    return parsed.pathname || "/";
  } catch {
    return "/pagina";
  }
}

export function sanitizeGooglePagePath(value) {
  const rawPath = pathnameFrom(value)
    .replace(/\/{2,}/g, "/");
  const pathname =
    rawPath.length > 1
      ? rawPath.replace(/\/$/, "")
      : rawPath;

  if (SAFE_STATIC_PAGE_PATHS.has(pathname)) {
    return pathname;
  }

  if (/^\/negocio\/[^/]+$/i.test(pathname)) {
    return "/negocio/:slug";
  }

  if (
    /^\/servicos\/[^/]+\/em\/[^/]+$/i
      .test(pathname)
  ) {
    return "/servicos/:categoria/em/:localidade";
  }

  if (
    /^\/painel\/servicos\/[^/]+\/editar$/i
      .test(pathname)
  ) {
    return "/painel/servicos/:id/editar";
  }

  return "/pagina";
}

function safeGooglePageTitle(pathname) {
  if (pathname === "/para-profissionais") {
    return "Agenda Fashion para profissionais";
  }

  if (pathname === "/planos") {
    return "Planos | Agenda Fashion";
  }

  if (pathname === "/privacidade") {
    return "Privacidade | Agenda Fashion";
  }

  if (pathname === "/termos") {
    return "Termos de uso | Agenda Fashion";
  }

  if (pathname === "/negocio/:slug") {
    return "Perfil profissional | Agenda Fashion";
  }

  if (
    pathname ===
      "/servicos/:categoria/em/:localidade"
  ) {
    return "Serviços de beleza | Agenda Fashion";
  }

  if (
    pathname.startsWith("/painel") ||
    pathname.startsWith("/profissional") ||
    pathname.startsWith("/admin")
  ) {
    return "Área de trabalho | Agenda Fashion";
  }

  return "Agenda Fashion";
}

function safeGooglePageContext(value) {
  const pathname = sanitizeGooglePagePath(value);

  return {
    page_location:
      `${window.location.origin}${pathname}`,
    page_title:
      safeGooglePageTitle(pathname),
    page_referrer: ""
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
    // O AF mede conversões, mas não habilita publicidade personalizada.
    ad_personalization: "denied"
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

  const nextUserId = userId
    ? String(userId)
    : null;
  const pageContext =
    safeGooglePageContext(
      window.location.pathname
    );
  const needsMeasurementConfig =
    initializedMeasurementId !==
      config.measurementId ||
    currentUserId !== nextUserId;

  if (needsMeasurementConfig) {
    gtag(
      "config",
      config.measurementId,
      {
        send_page_view: false,
        user_id: nextUserId,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location:
          pageContext.page_location,
        page_title:
          pageContext.page_title,
        page_referrer:
          pageContext.page_referrer
      }
    );
    initializedMeasurementId =
      config.measurementId;
    currentUserId = nextUserId;
  }

  if (
    config.adsId &&
    initializedAdsId !== config.adsId
  ) {
    gtag(
      "config",
      config.adsId,
      {
        allow_ad_personalization_signals: false,
        page_location:
          pageContext.page_location,
        page_title:
          pageContext.page_title,
        page_referrer:
          pageContext.page_referrer
      }
    );
    initializedAdsId = config.adsId;
  }

  appendGoogleScript(
    config.measurementId
  );

  return true;
}

export function googleCookieDomainCandidates(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "");
  const parts = normalized
    .split(".")
    .filter(Boolean);

  if (
    parts.length < 2 ||
    normalized === "localhost" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)
  ) {
    return [];
  }

  const countrySecondLevel =
    parts.at(-1)?.length === 2 &&
    parts.at(-2)?.length <= 3;
  const registrableSize =
    countrySecondLevel && parts.length >= 3
      ? 3
      : 2;
  const registrableDomain =
    parts.slice(-registrableSize).join(".");

  return [...new Set([
    normalized,
    registrableDomain
  ])];
}

function expireCookie(name) {
  document.cookie =
    `${name}=; Max-Age=0; Path=/; SameSite=Lax`;

  for (const domain of googleCookieDomainCandidates(
    window.location.hostname
  )) {
    document.cookie =
      `${name}=; Max-Age=0; Path=/; Domain=.${domain}; SameSite=Lax`;
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

function markGoogleConsentSyncPending(status) {
  const record = getMarketingConsentRecord();

  writeBrowserStorage(
    "local",
    GOOGLE_CONSENT_SYNC_KEY,
    JSON.stringify({
      status,
      updatedAt:
        record?.updatedAt ||
        new Date().toISOString(),
      textVersion:
        record?.textVersion || null
    })
  );
}

function clearGoogleConsentSyncPending() {
  removeBrowserStorage(
    "local",
    GOOGLE_CONSENT_SYNC_KEY
  );
}

export function hasPendingGoogleConsentSync() {
  try {
    const pending = JSON.parse(
      readBrowserStorage(
        "local",
        GOOGLE_CONSENT_SYNC_KEY
      ) || "null"
    );

    return (
      pending?.status ===
        MARKETING_CONSENT.GRANTED ||
      pending?.status ===
        MARKETING_CONSENT.DENIED
    );
  } catch {
    clearGoogleConsentSyncPending();
    return false;
  }
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

  if (!hasSession()) {
    return false;
  }

  markGoogleConsentSyncPending(status);

  const consentRecord =
    getMarketingConsentRecord();

  if (
    status ===
      MARKETING_CONSENT.DENIED
  ) {
    await apiRequest(
      "/marketing/google/consentimento",
      {
        method: "POST",
        body: {
          consentimento: false,
          origem:
            GOOGLE_CONSENT_SOURCE,
          texto_versao:
            consentRecord?.textVersion || null
        },
        timeoutMs: 5000
      }
    );

    clearGoogleConsentSyncPending();
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
        origem:
          GOOGLE_CONSENT_SOURCE,
        texto_versao:
          consentRecord?.textVersion || null,
        ...(clientId
          ? { client_id: clientId }
          : {})
      },
      timeoutMs: 5000
    }
  );

  clearGoogleConsentSyncPending();
  return true;
}

function normalizePagePath(pathname) {
  return sanitizeGooglePagePath(
    pathname || window.location.pathname
  );
}

export async function trackGooglePageView(
  pathname,
  userId
) {
  const key = normalizePagePath(pathname);

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
      page_title:
        safeGooglePageTitle(key),
      page_location:
        `${window.location.origin}${key}`,
      page_referrer: ""
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
      ...safeGooglePageContext(
        window.location.pathname
      ),
      ...params
    }
  );

  return true;
}

function safeTransactionId(value) {
  const text = String(value || "").trim();

  return /^[A-Za-z0-9._:-]{8,100}$/.test(text)
    ? text
    : null;
}

function safeSignUpMethod(value) {
  return ["email", "google"].includes(value)
    ? value
    : "other";
}

function safeCurrency(value) {
  const currency = String(value || "BRL")
    .trim()
    .toUpperCase();

  return /^[A-Z]{3}$/.test(currency)
    ? currency
    : "BRL";
}

function safePlanId(value) {
  const id = String(value || "plan")
    .trim()
    .toLowerCase();

  return /^[a-z0-9_-]{1,40}$/.test(id)
    ? id
    : "plan";
}

function safePlanName(value) {
  const name = String(
    value || "Plano Agenda Fashion"
  ).trim();

  return /^[\p{L}\p{N} ._-]{1,60}$/u.test(name)
    ? name
    : "Plano Agenda Fashion";
}

export async function trackGoogleSignUp(
  method = "email",
  transactionId
) {
  const ready =
    await initializeGoogleMeasurement();

  if (!ready) {
    return false;
  }

  const config = await getGoogleConfig();
  const safeId =
    safeTransactionId(transactionId);

  ensureGtag()(
    "event",
    "sign_up",
    {
      ...safeGooglePageContext(
        window.location.pathname
      ),
      method: safeSignUpMethod(method),
      ...(safeId
        ? { transaction_id: safeId }
        : {})
    }
  );

  await trackAdsConversion(
    config,
    config.signUpLabel,
    safeId
      ? { transaction_id: safeId }
      : {}
  );

  return true;
}

export async function trackGoogleBeginCheckout({
  currency = "BRL",
  value = 0,
  planId,
  planName,
  transactionId
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
      ? Math.max(0, numericValue)
      : 0;
  const normalizedCurrency =
    safeCurrency(currency);
  const safeId =
    safeTransactionId(transactionId);

  ensureGtag()(
    "event",
    "begin_checkout",
    {
      ...safeGooglePageContext(
        window.location.pathname
      ),
      currency: normalizedCurrency,
      value: safeValue,
      ...(safeId
        ? { transaction_id: safeId }
        : {}),
      items: [
        {
          item_id:
            safePlanId(planId),
          item_name:
            safePlanName(planName),
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
      currency: normalizedCurrency,
      ...(safeId
        ? { transaction_id: safeId }
        : {})
    }
  );

  return true;
}

export function resetGoogleMeasurementForTests() {
  configPromise = null;
  initializedMeasurementId = null;
  initializedAdsId = null;
  currentUserId = null;
  googleJsConfigured = false;
  lastPageView = "";
  defaultConsentApplied = false;
}
