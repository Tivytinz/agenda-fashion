import { postTelemetry } from "./transport";
import {
  ANALYTICS_IDENTITY_BOUNDARY_EVENT,
  ANALYTICS_VIEW_READY_EVENT,
  AUTH_REVISION_STORAGE_KEY,
  hasSession,
  normalizePlanSlug
} from "../auth/session";
import {
  ensureAnalyticsTabIsolation,
  parkAnalyticsOutbox,
  recoverParkedOutbox,
  pruneExpiredParkedOutboxes,
  releaseAnalyticsTab,
  scrubParkedAttribution
} from "./tabOutboxRecovery";
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";
import {
  getMarketingConsent,
  MARKETING_CONSENT,
  MARKETING_CONSENT_EVENT
} from "./marketingConsent";

const VISITOR_KEY = "af_analytics_visitor_v2";
const SESSION_KEY = "af_analytics_session_v2";
const ONBOARDING_FLOW_KEY = "af_analytics_onboarding_flow_v2";
const BOOKING_FLOW_KEY = "af_analytics_booking_flow_v2";
const OUTBOX_KEY = "af_analytics_outbox_v2";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const OUTBOX_TTL_MS = 24 * 60 * 60 * 1000;
const OUTBOX_MAX_ITEMS = 40;
const OUTBOX_FLUSH_LIMIT = 10;
const MARKETING_ACQUISITION_KEYS = [
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "ttclid"
];

let currentView = null;
let lifecycleBound = false;
let outboxFlushPromise = null;
let identityGeneration = 0;
let analyticsSuspended = false;
let legacyOutboxDiscarded = false;
let identityConfirmedForRecovery = false;

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

function stripMarketingAcquisition(acquisition = {}) {
  const next = {
    ...(acquisition || {})
  };

  for (const key of MARKETING_ACQUISITION_KEYS) {
    delete next[key];
  }

  return next;
}

function captureAcquisition() {
  const params = new URLSearchParams(window.location.search);
  const marketingGranted = getMarketingConsent() === MARKETING_CONSENT.GRANTED;
  const value = (key, limit) => String(params.get(key) || "").trim().slice(0, limit) || undefined;

  return {
    ...(marketingGranted
      ? {
          utmSource: value("utm_source", 80),
          utmMedium: value("utm_medium", 80),
          utmCampaign: value("utm_campaign", 140),
          utmContent: value("utm_content", 140),
          utmTerm: value("utm_term", 140),
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

// A posse por documento também cobre "Duplicar guia" sem window.opener.
function isolateInheritedTabStorage() {
  ensureAnalyticsTabIsolation();
}

function readSession() {
  isolateInheritedTabStorage();
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
        getMarketingConsent() === MARKETING_CONSENT.GRANTED
          ? stored.acquisition || {}
          : stripMarketingAcquisition(stored.acquisition || {}),
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

function route(pathname, search = "") {
  const path = String(pathname || "/").replace(/\/{2,}/g, "/");

  if (path === "/") return ["home", "/"];
  if (path === "/para-profissionais") return ["professional_landing", "/para-profissionais"];
  if (path === "/entrar") return ["login", "/entrar"];
  if (path === "/cadastro") {
    const params = new URLSearchParams(search);
    return [
      params.get("tipo") === "profissional" || Boolean(normalizePlanSlug(params.get("plano")))
        ? "professional_register"
        : "register",
      "/cadastro"
    ];
  }
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

function discardLegacyOutbox() {
  if (legacyOutboxDiscarded) return;
  // A fila antiga global não tem isolamento entre contas e abas.
  removeBrowserStorage("local", OUTBOX_KEY);
  legacyOutboxDiscarded = true;
}

function readOutbox() {
  isolateInheritedTabStorage();
  discardLegacyOutbox();
  try {
    const parsed = JSON.parse(
      readBrowserStorage("session", OUTBOX_KEY) || "[]"
    );
    if (!Array.isArray(parsed)) return [];

    const limite = Date.now() - OUTBOX_TTL_MS;
    return parsed
      .filter((entry) => (
        entry &&
        typeof entry === "object" &&
        uuidValido(entry.id) &&
        Number(entry.createdAt) >= limite &&
        entry.payload &&
        typeof entry.payload === "object"
      ))
      .slice(-OUTBOX_MAX_ITEMS);
  } catch {
    return [];
  }
}

function writeOutbox(entries) {
  discardLegacyOutbox();
  const pending = (Array.isArray(entries) ? entries : []).slice(-OUTBOX_MAX_ITEMS);
  const saved = writeBrowserStorage("session", OUTBOX_KEY, JSON.stringify(pending));
  // Diário durável por guia. A gravação acontece na inclusão, não somente no
  // fechamento; cobre encerramentos abruptos que não emitem pagehide.
  parkAnalyticsOutbox({
    entries: pending.map(entry => ({
      ...entry,
      payload: getMarketingConsent() === MARKETING_CONSENT.GRANTED
        ? entry.payload
        : {
            ...entry.payload,
            acquisition: stripMarketingAcquisition(entry.payload?.acquisition || {})
          }
    })),
    revision: authRevision(),
    visitorId: visitorUuid()
  });
  return saved;
}

function authRevision() {
  return readBrowserStorage("local", AUTH_REVISION_STORAGE_KEY) || "";
}

function restorePendingOutbox({ confirmed = false } = {}) {
  if (confirmed) identityConfirmedForRecovery = true;
  if (analyticsSuspended || (hasSession() && !identityConfirmedForRecovery)) return;
  const added = recoverParkedOutbox({
    revision: authRevision(),
    visitorId: visitorUuid(),
    entries: readOutbox(),
    persist: entries => writeOutbox(
      getMarketingConsent() === MARKETING_CONSENT.GRANTED
        ? entries
        : entries.map(entry => ({
            ...entry,
            payload: {
              ...entry.payload,
              acquisition: stripMarketingAcquisition(entry.payload?.acquisition || {})
            }
          }))
    )
  });
  if (added > 0 || readOutbox().length > 0) void flushOutbox();
}

function enqueuePayload(payload) {
  const entry = {
    id: uuid(),
    createdAt: Date.now(),
    payload
  };

  writeOutbox([
    ...readOutbox(),
    entry
  ]);

  return entry.id;
}

function removeOutboxEntry(id) {
  writeOutbox(
    readOutbox().filter((entry) => entry.id !== id)
  );
}

export function clearFirstPartyMarketingAttribution() {
  try {
    const session = readSession();

    if (session) {
      writeSession({
        ...session,
        acquisition:
          stripMarketingAcquisition(
            session.acquisition || {}
          )
      });
    }

    writeOutbox(
      readOutbox().map((entry) => ({
        ...entry,
        payload: {
          ...entry.payload,
          acquisition:
            stripMarketingAcquisition(
              entry.payload?.acquisition || {}
            )
        }
      }))
    );
    scrubParkedAttribution(stripMarketingAcquisition);
  } catch {
    // Privacidade deve falhar de forma conservadora sem bloquear a aplicação.
  }
}

async function postPayload(payload, { keepalive = false } = {}) {
  // Uma revogação pode acontecer depois da gravação do lote: aplicar também
  // no último ponto antes da transmissão para evitar atribuição sem consentimento.
  const sanitized = getMarketingConsent() === MARKETING_CONSENT.GRANTED
    ? payload
    : { ...payload, acquisition: stripMarketingAcquisition(payload.acquisition || {}) };
  const response = await postTelemetry("/analytics/collect", sanitized, { keepalive });

  if (!response?.ok) {
    const error = new Error("Falha ao entregar analytics first-party.");
    error.retryable = ![
      400,
      401,
      403,
      409,
      413,
      422
    ].includes(Number(response?.status));
    throw error;
  }
}

async function flushOutbox({ keepalive = false } = {}) {
  if (analyticsSuspended) return;
  if (outboxFlushPromise) return outboxFlushPromise;

  const generation = identityGeneration;
  const work = (async () => {
    let processed = 0;
    while (processed < OUTBOX_FLUSH_LIMIT && generation === identityGeneration) {
      const entry = readOutbox()[0];
      if (!entry) break;
      try {
        await postPayload(entry.payload, { keepalive });
        // Um POST antigo pode terminar depois do logout: não drenar a fila nova.
        if (generation !== identityGeneration) break;
        removeOutboxEntry(entry.id);
        // O espaço recém-liberado permite recuperar parte da fila de outra
        // guia sem descartar o excedente ainda estacionado.
        restorePendingOutbox();
      } catch (error) {
        if (generation !== identityGeneration) break;
        if (error?.retryable === false) {
          removeOutboxEntry(entry.id);
          processed += 1;
          continue;
        }
        break;
      }
      processed += 1;
    }
  })();
  outboxFlushPromise = work;
  try {
    await work;
  } finally {
    if (outboxFlushPromise === work) {
      outboxFlushPromise = null;
      if (identityGeneration !== generation && readOutbox().length) {
        void flushOutbox();
      }
    }
  }
}

// A fronteira invalida lotes pendentes, fluxos e sessão sem apagar a identidade
// pseudônima do navegador; previne atribuição cruzada entre contas.
export function resetFirstPartyAnalyticsSession({ suspend = false } = {}) {
  identityGeneration += 1;
  currentView = null;
  analyticsSuspended = suspend;
  // POST antigo não deve bloquear a fila nova se nunca responder.
  // Sua finalização ainda respeita identityGeneration e não altera o lote novo.
  outboxFlushPromise = null;
  identityConfirmedForRecovery = false;
  removeBrowserStorage("session", SESSION_KEY);
  removeBrowserStorage("session", ONBOARDING_FLOW_KEY);
  removeBrowserStorage("session", BOOKING_FLOW_KEY);
  writeOutbox([]);
}

async function send(items, { keepalive = false } = {}) {
  try {
    if (analyticsSuspended || !Array.isArray(items) || items.length === 0) return;
    const session = touchSession(ensureSession());
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

    enqueuePayload({
      visitorUuid: visitorUuid(),
      sessionUuid: session.id,
      device: deviceInfo(),
      acquisition,
      items
    });

    await flushOutbox({ keepalive });
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

  window.addEventListener("pagehide", event => {
    // O engagement final entra no diário no momento do enqueue.
    flushCurrentView("pagehide", true);
    // Em bfcache, o documento continua vivo; preservar sua posse.
    if (!event.persisted) releaseAnalyticsTab();
  });

  window.addEventListener("online", () => {
    restorePendingOutbox();
    void flushOutbox();
  });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restorePendingOutbox();
  });
  pruneExpiredParkedOutboxes();
  // Encerramentos abruptos nem sempre emitem pagehide. Reavaliar a posse
  // expirada também quando a guia permanece aberta sem outro evento.
  window.setInterval(() => {
    pruneExpiredParkedOutboxes();
    if (document.visibilityState !== "hidden" && navigator.onLine !== false) {
      restorePendingOutbox();
    }
  }, 60_000);
  window.addEventListener(ANALYTICS_VIEW_READY_EVENT, () => {
    // O bridge pode retirar a suspensão na mesma emissão do evento.
    // Recuperar após seus listeners evita adiar a fila para o próximo online.
    queueMicrotask(() => restorePendingOutbox({ confirmed: true }));
  });

  const enforceConsent = () => {
    if (getMarketingConsent() !== MARKETING_CONSENT.GRANTED) {
      clearFirstPartyMarketingAttribution();
    }
  };
  window.addEventListener(MARKETING_CONSENT_EVENT, enforceConsent);
  window.addEventListener("storage", (event) => {
    if (event.key === "af_marketing_consent_v2") enforceConsent();
  });

  window.addEventListener(ANALYTICS_IDENTITY_BOUNDARY_EVENT, () => {
    resetFirstPartyAnalyticsSession({ suspend: true });
  });
  restorePendingOutbox();
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
  state = null,
  resumeAfterBoundary = false
}) {
  try {
    bindLifecycle();
    if (analyticsSuspended && !resumeAfterBoundary) return;
    // Readiness repetido ou refresh silencioso não duplica a view ativa.
    if (resumeAfterBoundary && !analyticsSuspended && currentView) return;
    if (resumeAfterBoundary) analyticsSuspended = false;
    const [pageKey, routeTemplate] = route(pathname, search);

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
      const repeatIntent =
        properties.origem === "agendar_novamente";

      canonicalName = "booking_started";
      canonicalProperties = {
        entry_point: currentView.pageKey,
        intent: repeatIntent
          ? "repeat_booking"
          : "new_booking",
        ...(repeatIntent && properties.status
          ? {
              source_booking_status:
                String(properties.status).slice(0, 40)
            }
          : {})
      };
      flowUuidValue = flowUuid(BOOKING_FLOW_KEY, { renew: true });
    } else if (name === "perfil_visualizado") {
      canonicalName = "profile_viewed";
      canonicalProperties = {
        entry_point: String(properties.origem || currentView.pageKey).slice(0, 120)
      };
    } else if (name === "agendamento_concluido") {
      canonicalName = "booking_completed";
      canonicalProperties = {
        status: String(properties.status || "sucesso").slice(0, 120)
      };
      flowUuidValue = flowUuid(BOOKING_FLOW_KEY);
    } else if (
      /^link_(negocio|servico)_(copiado|compartilhado)$/.test(name)
    ) {
      canonicalName = "profile_shared";
      canonicalProperties = {
        method: String(properties.metodo || "share").slice(0, 120)
      };
      flowUuidValue = flowUuid(ONBOARDING_FLOW_KEY);
    } else if ([
      "professional_signup_started",
      "professional_signup_submitted",
      "professional_signup_validation_error",
      "professional_signup_request_error"
    ].includes(name)) {
      if (currentView.pageKey !== "professional_register") return;
      if (name === "professional_signup_validation_error") {
        const fields = ["name", "email", "whatsapp", "password", "password_confirmation", "form"];
        const reasons = ["required", "too_short", "too_long", "invalid_format", "invalid_length", "mismatch"];
        if (!fields.includes(properties.field) || !reasons.includes(properties.reason)) return;
        canonicalProperties = { field: properties.field, reason: properties.reason };
      } else if (name === "professional_signup_request_error") {
        const reasons = [
          "conflict", "invalid_request", "auth_rejected", "rate_limited",
          "timeout", "network_error", "server_error", "unknown"
        ];
        if (!["email", "google"].includes(properties.method) || !reasons.includes(properties.reason)) return;
        canonicalProperties = { method: properties.method, reason: properties.reason };
      } else if (name === "professional_signup_started") {
        const triggers = ["form_input", "google_credential"];
        if (!["email", "google"].includes(properties.method) || !triggers.includes(properties.trigger)) return;
        if ((properties.method === "google") !== (properties.trigger === "google_credential")) return;
        canonicalProperties = { method: properties.method, trigger: properties.trigger };
      } else {
        if (!["email", "google"].includes(properties.method)) return;
        canonicalProperties = { method: properties.method };
      }
      flowUuidValue = flowUuid(ONBOARDING_FLOW_KEY);
    } else if (!["business_creation_started", "first_service_creation_started", "profile_viewed", "profile_shared", "booking_started", "booking_completed", "checkout_viewed"].includes(name)) {
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
        bookingId: canonicalName === "booking_completed"
          ? properties.agendamento_id || undefined
          : undefined,
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
  clearFirstPartyMarketingAttribution,
  stripMarketingAcquisition,
  deviceInfo,
  mergeDefined,
  uuidValido,
  readOutbox,
  flushOutbox,
  resetFirstPartyAnalyticsSession,
  send
};
