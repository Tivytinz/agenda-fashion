const SESSION_KEY = "af_produto_sessao";
const ATTRIBUTION_KEY = "af_marketing_attribution";

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
  const current = sessionStorage.getItem(SESSION_KEY);

  if (current) {
    return current;
  }

  const created = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
  sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function readStoredAttribution() {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(ATTRIBUTION_KEY) || "null"
    );

    return stored && typeof stored === "object" && !Array.isArray(stored)
      ? stored
      : {};
  } catch {
    return {};
  }
}

function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const incoming = {};

  for (const key of ATTRIBUTION_PARAMS) {
    const value = params.get(key)?.trim();

    if (value) {
      incoming[key] = value;
    }
  }

  if (!Object.keys(incoming).length) {
    return readStoredAttribution();
  }

  const stored = readStoredAttribution();
  const attribution = {
    ...stored,
    ...incoming,
    landing_page: stored.landing_page || window.location.pathname
  };

  sessionStorage.setItem(
    ATTRIBUTION_KEY,
    JSON.stringify(attribution)
  );

  return attribution;
}

export function track(name, {
  page,
  mission,
  businessId,
  properties = {}
}) {
  const attribution = captureAttribution();

  const payload = {
    nome: name,
    pagina: page,
    missao: mission,
    sessao_id: sessionId(),
    negocio_id: businessId || undefined,
    propriedades: {
      ...attribution,
      ...properties
    }
  };

  const token = localStorage.getItem("token");

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
}
