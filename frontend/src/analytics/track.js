import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const SESSION_KEY = "af_produto_sessao";
const ATTRIBUTION_KEY = "af_marketing_attribution";
const REFERRER_KEY = "af_acquisition_referrer_host";
const DIRECT_REFERRER = "__direct__";
const ATTRIBUTION_VERSION = 2;
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid"
];

function sessionId() {
  const current = readBrowserStorage("session", SESSION_KEY);

  if (current) {
    return current;
  }

  let created = "";

  try {
    created = globalThis.crypto
      ?.randomUUID?.()
      ?.replace(/-/g, "")
      .slice(0, 32) || "";
  } catch {
    created = "";
  }

  if (!created) {
    created = (
      `af${Date.now().toString(36)}` +
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2)
    ).slice(0, 32);
  }

  writeBrowserStorage("session", SESSION_KEY, created);
  return created;
}

function acquisitionReferrerHost() {
  const stored = readBrowserStorage("session", REFERRER_KEY);

  if (stored) {
    return stored === DIRECT_REFERRER ? "" : stored;
  }

  let host = "";

  try {
    const referrer = String(document.referrer || "").trim();

    if (referrer) {
      const parsed = new URL(referrer);
      const currentOrigin = String(window.location.origin || "");

      if (parsed.origin !== currentOrigin) {
        host = parsed.hostname
          .trim()
          .toLowerCase()
          .slice(0, 200);
      }
    }
  } catch {
    host = "";
  }

  writeBrowserStorage(
    "session",
    REFERRER_KEY,
    host || DIRECT_REFERRER
  );

  return host;
}

function safeObject(value) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : null;
}

function parseStored(raw) {
  if (!raw) {
    return null;
  }

  try {
    return safeObject(JSON.parse(raw));
  } catch {
    return null;
  }
}

function legacyTouch(stored, capturedAt) {
  const touch = {};

  for (const key of ATTRIBUTION_PARAMS) {
    const value = stored?.[key];

    if (typeof value === "string" && value.trim()) {
      touch[key] = value.trim();
    }
  }

  if (stored?.landing_page) {
    touch.landing_page = stored.landing_page;
  }

  touch.captured_at = capturedAt;
  return touch;
}

function normalizeStored(stored) {
  if (!safeObject(stored)) {
    return null;
  }

  const now = Date.now();

  if (
    stored.version === ATTRIBUTION_VERSION &&
    safeObject(stored.first_touch) &&
    safeObject(stored.last_touch)
  ) {
    const expiresAt = Number(stored.expires_at);

    if (Number.isFinite(expiresAt) && expiresAt <= now) {
      return null;
    }

    return {
      version: ATTRIBUTION_VERSION,
      first_touch: stored.first_touch,
      last_touch: stored.last_touch,
      expires_at:
        Number.isFinite(expiresAt)
          ? expiresAt
          : now + ATTRIBUTION_WINDOW_MS
    };
  }

  const legacy = legacyTouch(
    stored,
    new Date(now).toISOString()
  );

  const hasAttribution = ATTRIBUTION_PARAMS.some(
    (key) => Boolean(legacy[key])
  );

  if (!hasAttribution) {
    return null;
  }

  return {
    version: ATTRIBUTION_VERSION,
    first_touch: legacy,
    last_touch: legacy,
    expires_at: now + ATTRIBUTION_WINDOW_MS
  };
}

function clearStoredAttribution() {
  removeBrowserStorage("local", ATTRIBUTION_KEY);
  removeBrowserStorage("session", ATTRIBUTION_KEY);
}

function readStoredAttribution() {
  const local = normalizeStored(
    parseStored(
      readBrowserStorage("local", ATTRIBUTION_KEY)
    )
  );

  if (local) {
    return local;
  }

  const legacySession = normalizeStored(
    parseStored(
      readBrowserStorage("session", ATTRIBUTION_KEY)
    )
  );

  if (legacySession) {
    writeBrowserStorage(
      "local",
      ATTRIBUTION_KEY,
      JSON.stringify(legacySession)
    );
    removeBrowserStorage("session", ATTRIBUTION_KEY);
    return legacySession;
  }

  clearStoredAttribution();
  return null;
}

function incomingTouch() {
  const params = new URLSearchParams(window.location.search);
  const touch = {};

  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key)?.trim();

    if (value) {
      touch[key] = value;
    }
  }

  if (!Object.keys(touch).length) {
    return null;
  }

  return {
    ...touch,
    landing_page: window.location.pathname,
    captured_at: new Date().toISOString()
  };
}

function contextFromStored(stored) {
  if (!stored) {
    return {};
  }

  const first = stored.first_touch || {};
  const last = stored.last_touch || first;
  const context = {};

  for (const key of ATTRIBUTION_PARAMS) {
    if (first[key]) {
      context[key] = first[key];
    }

    if (last[key]) {
      context[`last_${key}`] = last[key];
    }
  }

  if (first.landing_page) {
    context.landing_page = first.landing_page;
  }

  if (last.landing_page) {
    context.last_landing_page = last.landing_page;
  }

  if (first.captured_at) {
    context.attribution_first_at = first.captured_at;
  }

  if (last.captured_at) {
    context.attribution_last_at = last.captured_at;
  }

  return context;
}

function captureAttribution() {
  const incoming = incomingTouch();
  const stored = readStoredAttribution();

  if (!incoming) {
    return contextFromStored(stored);
  }

  const next = {
    version: ATTRIBUTION_VERSION,
    first_touch: stored?.first_touch || incoming,
    last_touch: incoming,
    expires_at: Date.now() + ATTRIBUTION_WINDOW_MS
  };

  writeBrowserStorage(
    "local",
    ATTRIBUTION_KEY,
    JSON.stringify(next)
  );
  removeBrowserStorage("session", ATTRIBUTION_KEY);

  return contextFromStored(next);
}

export function getMarketingContext(
  intent = "indefinida"
) {
  const attribution = captureAttribution();

  return {
    intencao: intent,
    sessao_id: sessionId(),
    ...attribution
  };
}

export function track(name, {
  page,
  mission,
  businessId,
  properties = {}
}) {
  try {
    const attribution = captureAttribution();
    const referrerHost = acquisitionReferrerHost();

    const payload = {
      nome: name,
      pagina: page,
      missao: mission,
      sessao_id: sessionId(),
      negocio_id: businessId || undefined,
      propriedades: {
        ...(referrerHost ? { referrer_host: referrerHost } : {}),
        ...attribution,
        ...properties
      }
    };

    const token = readBrowserStorage("local", "token");

    void fetch(`${String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "")}/eventos-produto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Métricas nunca bloqueiam o agendamento.
    });
  } catch {
    // Compatibilidade e privacidade do navegador nunca bloqueiam a interface.
  }
}
