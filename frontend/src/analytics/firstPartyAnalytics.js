import {
  readBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";
import {
  getMarketingConsent,
  MARKETING_CONSENT
} from "./marketingConsent";

const API_URL = String(import.meta.env.VITE_API_URL || "")
  .replace(/\/+$/, "");
const VISITOR_KEY = "af_analytics_visitor_v2";
const SESSION_KEY = "af_analytics_session_v2";
const ONBOARDING_FLOW_KEY = "af_analytics_onboarding_flow_v2";
const BOOKING_FLOW_KEY = "af_analytics_booking_flow_v2";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

let currentView = null;
let lifecycleBound = false;

function uuid() {
  try {
    const value = globalThis.crypto?.randomUUID?.();
    if (value) return value.toLowerCase();
  } catch {
    // Fallback abaixo mantém analytics não bloqueante.
  }

  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto?.getRandomValues?.(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function uuidValido(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ""));
}

function parseJson(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function mergeDefined(base = {}, incoming = {}) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming || {})) {
    if (value !== undefined && value !== null && value !== "") {
      merged[key] = value;
    }
  }

  return merged;
}

function visitorUuid() {
  const current = readBrowserStorage("local", VISITOR_KEY);
  if (uuidValido(current)) return current.toLowerCase();

  const created = uuid();
  writeBrowserStorage("local", VISITOR_KEY, created);
  return created;
}

function externalReferrerHost() {
  try {
    const referrer = String(document.referrer || "").trim();
    if (!referrer) return "";
    const parsed = new URL(referrer);
    if (parsed.origin === window.location.origin) return "";
    return parsed.hostname.toLowerCase().slice(0, 200);
  } catch {
    return "";
  }
}

function captureAcquisition() {
  const params = new URLSearchParams(window.location.search);
  const marketingGranted = getMarketingConsent() === MARKETING_CONSENT.GRANTED;
  const value = (key, limit) => String(params.get(key) || "").trim().slice(0, limit) || undefined;

  return {
    utmSource: value("utm_source", 80),
    utmMedium: value("utm_medium", 80),
    utmCampaign: value("utm_campaign", 140),
    utmContent: value("utm_content", 140),
    utmTerm: value("utm_term", 140),
    ...(marketingGranted
      ? {
          gclid: value("gclid", 200),
          gbraid: value("gbraid", 200),
          wbraid: value("wbraid", 200),
          fbclid: value("fbclid", 200),
          msclkid: value("msclkid", 200),
          ttclid: value("ttclid", 200)
        }
      : {}),
    landingPage: window.location.pathname.slice(0, 500),
    referrerHost: externalReferrerHost() || undefined
  };
}

function readSession() {
  return parseJson(readBrowserStorage("session", SESSION_KEY));
}

function writeSession(session) {
  writeBrowserStorage("session", SESSION_KEY, JSON.stringify(session));
  return session;
}

function ensureSession() {
  const now = Date.now();
  const stored = readSession();
  const reusable =
    uuidValido(stored?.id) &&
    Number.isFinite(Number(stored?.lastActivityAt)) &&
    now - Number(stored.lastActivityAt) <= SESSION_TIMEOUT_MS;

  if (reusable) {
    return writeSession({
      ...stored,
      lastActivityAt: now,
      sequence: Number.isInteger(Number(stored.sequence))
        ? Number(stored.sequence)
        : 0,
      acquisition: mergeDefined(
        stored.acquisition || {},
        captureAcquisition()
      )
    });
  }

  return writeSession({
    id: uuid(),
    startedAt: now,
    lastActivityAt: now,
    sequence: 0,
    acquisition: captureAcquisition()
  });
}

function touchSession(session) {
  return writeSession({
    ...session,
    lastActivityAt: Date.now()
  });
}

function deviceInfo() {
  const ua = String(navigator.userAgent || "");
  const mobile = /Mobi|Android|iPhone|iPod/i.test(ua);
  const tablet = /iPad|Tablet/i.test(ua);
  const browserMatch =
    ua.match(/Edg\/(\d+)/) ||
    ua.match(/Firefox\/(\d+)/) ||
    ua.match(/Chrome\/(\d+)/) ||
    ua.match(/Version\/(\d+).*Safari/);

  let browser = "Other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";

  let os = "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return {
    type: tablet ? "tablet" : mobile ? "mobile" : "desktop",
    browser,
    browserMajor: browserMatch?.[1] || undefined,
    os
  };
}

function route(pathname) {
  const path = String(pathname || "/").replace(/\/{2,}/g, "/");

  if (path === "/") return ["home", "/"];
  if (path === "/para-profissionais") return ["professional_landing", "/para-profissionais"];
  if (path === "/entrar") return ["login", "/entrar"];
  if (path === "/cadastro") return ["register", "/cadastro"];
  if (path === "/criar-negocio") return ["create_business", "/criar-negocio"];
  if (path === "/planos") return ["plans", "/planos"];
  if (path === "/checkout") return ["checkout", "/checkout"];
  if (path === "/painel") return ["owner_dashboard", "/painel"];
  if (path === "/painel/agenda") return ["owner_agenda", "/painel/agenda"];
  if (path === "/painel/servicos") return ["services", "/painel/servicos"];
  if (path === "/painel/servicos/novo") return ["new_service", "/painel/servicos/novo"];
  if (/^\/painel\/servicos\/\d+\/editar$/.test(path)) return ["edit_service", "/painel/servicos/:id/editar"];
  if (path === "/painel/horarios") return ["schedule_settings", "/painel/horarios"];
  if (path === "/painel/negocio") return ["business_settings", "/painel/negocio"];
  if (path === "/painel/assinatura") return ["subscription", "/painel/assinatura"];
  if (path === "/conta") return ["account", "/conta"];
  if (path === "/favoritos") return ["favorites", "/favoritos"];
  if (path === "/minha-agenda") return ["customer_agenda", "/minha-agenda"];
  if (/^\/negocio\/[^/]+$/.test(path)) return ["business_profile", "/negocio/:slug"];
  if (/^\/servicos\/[^/]+\/em\/[^/]+$/.test(path)) return ["local_catalog", "/servicos/:categoria/em/:localidade"];
  if (path.startsWith("/admin")) return ["admin", "/admin"];
  return ["other", "/other"];
}

function serviceIdFromPath(pathname) {
  const match = String(pathname || "").match(/^\/painel\/servicos\/(\d+)\/editar$/);
  return match ? Number(match[1]) : undefined;
}

function flowUuid(key, { renew = false } = {}) {
  const current = readBrowserStorage("session", key);
  if (!renew && uuidValido(current)) return current.toLowerCase();
  const created = uuid();
  writeBrowserStorage("session", key, created);
  return created;
}

async function send(items, { keepalive = false } = {}) {
  try {
    if (!Array.isArray(items) || items.length === 0) return;
    const session = touchSession(ensureSession());
    const token = readBrowserStorage("local", "token");
    const acquisition = mergeDefined(
      session.acquisition || {},
      captureAcquisition()
    );

    if (JSON.stringify(acquisition) !== JSON.stringify(session.acquisition || {})) {
      writeSession({
        ...session,
        acquisition,
        lastActivityAt: Date.now()
      });
    }

    await fetch(`${API_URL}/analytics/collect`, {
      method: "POST",
      credentials: "include",
      keepalive,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        visitorUuid: visitorUuid(),
        sessionUuid: session.id,
        device: deviceInfo(),
        acquisition,
        items
      })
    });
  } catch {
    // Analytics nunca bloqueia navegação, cadastro, compra ou agendamento.
  }
}

function nowIso() {
  return new Date().toISOString();
}

function visibleNow() {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function engagedMs(view) {
  let total = view.engagedMs;
  if (view.visibleSince !== null) {
    total += Math.max(0, performance.now() - view.visibleSince);
  }
  return Math.round(total);
}

function pauseEngagement() {
  if (!currentView || currentView.visibleSince === null) return;
  currentView.engagedMs = engagedMs(currentView);
  currentView.visibleSince = null;
}

function resumeEngagement() {
  if (!currentView || currentView.visibleSince !== null || !visibleNow()) return;
  currentView.visibleSince = performance.now();
}

function flushCurrentView(reason, close) {
  if (!currentView) return;
  pauseEngagement();
  const view = currentView;

  void send([
    {
      type: "engagement",
      viewUuid: view.viewUuid,
      engagedMs: Math.max(0, Math.round(view.engagedMs)),
      occurredAt: nowIso(),
      reason,
      close
    }
  ], { keepalive: close });

  if (close) currentView = null;
}

function bindLifecycle() {
  if (lifecycleBound || typeof document === "undefined") return;
  lifecycleBound = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushCurrentView("hidden", false);
    } else {
      resumeEngagement();
    }
  });

  window.addEventListener("pagehide", () => {
    flushCurrentView("pagehide", true);
  });
}

function autoJourneyEvent(pageKey, search, state) {
  const params = new URLSearchParams(search || "");

  if (pageKey === "create_business") {
    return {
      name: "business_creation_started",
      flowUuid: flowUuid(ONBOARDING_FLOW_KEY),
      properties: {
        entry_point: String(state?.from || "route").slice(0, 120)
      }
    };
  }

  if (
    pageKey === "new_service" &&
    (
      params.get("onboarding") === "servico" ||
      state?.onboardingStep === "servico"
    )
  ) {
    return {
      name: "first_service_creation_started",
      flowUuid: flowUuid(ONBOARDING_FLOW_KEY),
      properties: {
        entry_point: "onboarding"
      }
    };
  }

  if (pageKey === "checkout") {
    return {
      name: "checkout_viewed",
      properties: {
        plan_slug: String(params.get("plano") || "").slice(0, 120)
      }
    };
  }

  return null;
}

export function startFirstPartyPageView({
  pathname,
  search = "",
  state = null
}) {
  try {
    bindLifecycle();
    const [pageKey, routeTemplate] = route(pathname);

    // Não mede o uso do próprio painel administrativo para não inflar usuários ativos.
    if (pageKey === "admin") {
      flushCurrentView("navigate", true);
      return;
    }

    flushCurrentView("navigate", true);

    const session = ensureSession();
    const nextSequence = Number(session.sequence || 0) + 1;
    writeSession({
      ...session,
      sequence: nextSequence,
      lastActivityAt: Date.now()
    });

    currentView = {
      viewUuid: uuid(),
      pageKey,
      sequence: nextSequence,
      engagedMs: 0,
      visibleSince: visibleNow() ? performance.now() : null
    };

    const pageView = {
      type: "page_view",
      viewUuid: currentView.viewUuid,
      sequence: nextSequence,
      pageKey,
      routeTemplate,
      targetServiceId: serviceIdFromPath(pathname),
      occurredAt: nowIso()
    };

    const journey = autoJourneyEvent(pageKey, search, state);
    const items = [pageView];

    if (journey) {
      items.push({
        type: "event",
        eventUuid: uuid(),
        viewUuid: currentView.viewUuid,
        schemaVersion: 1,
        occurredAt: nowIso(),
        ...journey
      });
    }

    void send(items);
  } catch {
    // Compatibilidade do navegador nunca bloqueia a aplicação.
  }
}

export function trackFirstPartyEvent(name, {
  businessId,
  serviceId,
  properties = {},
  flow = null
} = {}) {
  try {
    if (!currentView || currentView.pageKey === "admin") return;

    let canonicalName = name;
    let canonicalProperties = properties;
    let flowUuidValue = null;

    if (name === "agendamento_iniciado") {
      canonicalName = "booking_started";
      canonicalProperties = {
        entry_point: currentView.pageKey
      };
      flowUuidValue = flowUuid(BOOKING_FLOW_KEY, { renew: true });
    } else if (
      /^link_(negocio|servico)_(copiado|compartilhado)$/.test(name)
    ) {
      canonicalName = "profile_shared";
      canonicalProperties = {
        method: String(properties.metodo || "share").slice(0, 120)
      };
      flowUuidValue = flowUuid(ONBOARDING_FLOW_KEY);
    } else if (!["business_creation_started", "first_service_creation_started", "profile_shared", "booking_started", "checkout_viewed"].includes(name)) {
      return;
    }

    if (flow && uuidValido(flow)) {
      flowUuidValue = flow;
    }

    void send([
      {
        type: "event",
        eventUuid: uuid(),
        viewUuid: currentView.viewUuid,
        schemaVersion: 1,
        name: canonicalName,
        occurredAt: nowIso(),
        targetBusinessId: businessId || undefined,
        targetServiceId: serviceId || properties.servico_id || undefined,
        flowUuid: flowUuidValue || undefined,
        properties: canonicalProperties
      }
    ]);
  } catch {
    // Analytics nunca bloqueia a ação do usuário.
  }
}

export const firstPartyAnalyticsInternals = {
  route,
  captureAcquisition,
  deviceInfo,
  mergeDefined,
  uuidValido
};
