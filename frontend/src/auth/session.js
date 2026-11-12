import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const SESSION_ACTIVE_KEY = "session_active";
const SESSION_KEYS = ["token", SESSION_ACTIVE_KEY, "usuario", "negocio"];
export const SESSION_CLEARED_EVENT = "agenda-fashion:session-cleared";
export const ANALYTICS_IDENTITY_BOUNDARY_EVENT = "agenda-fashion:analytics-identity-boundary";
export const ANALYTICS_VIEW_READY_EVENT = "agenda-fashion:analytics-view-ready";
export const AUTH_REVISION_STORAGE_KEY = "af_auth_revision_v1";
export const AUTH_LOGOUT_READY_STORAGE_KEY = "af_auth_logout_ready_v1";

function broadcastAuthChange(key) {
  // Apenas um marcador opaco e efêmero; nunca propagar identidade ou token.
  writeBrowserStorage("local", key, `${Date.now()}-${Math.random()}`);
}

export function notifyAnalyticsIdentityBoundary({ broadcast = true } = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_IDENTITY_BOUNDARY_EVENT));
  }
  if (broadcast) broadcastAuthChange(AUTH_REVISION_STORAGE_KEY);
}

export function notifyAnalyticsViewReady({ broadcastLogout = false } = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_VIEW_READY_EVENT));
  }
  if (broadcastLogout) broadcastAuthChange(AUTH_LOGOUT_READY_STORAGE_KEY);
}

let requestGeneration = 0;

export function getSessionRequestGeneration() {
  return requestGeneration;
}

export function invalidateSessionRequests() {
  requestGeneration += 1;
}

export function clearStoredSessionMetadata() {
  removeBrowserStorage("local", "usuario");
  removeBrowserStorage("local", "negocio");
}

export function completeLegacySessionMigration() {
  invalidateSessionRequests();
  removeBrowserStorage("local", "token");
  writeBrowserStorage("local", SESSION_ACTIVE_KEY, "1");
}

export function saveSession(result) {
  // O primeiro cadastro anônimo preserva sua sessão de tentativa.
  // Reautenticação de uma conta existente inicia uma sessão de analytics nova.
  const wasAuthenticated = hasSession();
  if (result?.usuario) {
    if (wasAuthenticated) notifyAnalyticsIdentityBoundary();
    else broadcastAuthChange(AUTH_REVISION_STORAGE_KEY);
  }
  removeBrowserStorage("local", "token");
  clearStoredSessionMetadata();

  if (!result?.usuario) {
    return;
  }

  invalidateSessionRequests();
  writeBrowserStorage("local", SESSION_ACTIVE_KEY, "1");
}

export function clearSession({ notify = false } = {}) {
  invalidateSessionRequests();
  SESSION_KEYS.forEach((key) => removeBrowserStorage("local", key));
  // A ordem importa: outras abas observam a sessão local já invalidada.
  notifyAnalyticsIdentityBoundary();

  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}

export function hasSession() {
  return Boolean(
    readBrowserStorage("local", SESSION_ACTIVE_KEY) ||
    readBrowserStorage("local", "token")
  );
}


export function safeInternalPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "";
}

export function normalizePlanSlug(value) {
  const slug = String(value || "").trim().toLocaleLowerCase("pt-BR");

  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ? slug.slice(0, 80)
    : "";
}

export function getPlanIntentPath(path, planSlug) {
  const safePath = safeInternalPath(path);
  const plan = normalizePlanSlug(planSlug);

  if (!safePath || !plan) {
    return safePath;
  }

  const separator = safePath.includes("?") ? "&" : "?";
  return `${safePath}${separator}plano=${encodeURIComponent(plan)}`;
}

export function getBusinessContext(session, preferredRole = "") {
  const role = String(preferredRole || "").trim();
  const links = Array.isArray(session?.vinculos)
    ? session.vinculos.filter(Boolean)
    : [];

  if (role) {
    return links.find((business) => business?.papel === role) ||
      (session?.negocio?.papel === role ? session.negocio : null);
  }

  return session?.negocioPrincipal || session?.negocio || links[0] || null;
}

export function getBusinessContextForPath(session, pathname) {
  const path = safeInternalPath(pathname) || "/";

  if (path === "/painel" || path.startsWith("/painel/")) {
    return getBusinessContext(session, "dono");
  }

  if (path === "/profissional" || path.startsWith("/profissional/")) {
    return getBusinessContext(session, "profissional");
  }

  return getBusinessContext(session);
}

export function getBusinessWorkspacePath(session, preferredRole = "") {
  const preferred = preferredRole
    ? getBusinessContext(session, preferredRole)
    : null;
  const business = preferred || getBusinessContext(session);

  if (!business) {
    if (session?.temReservasProfissionaisRestritas) return "/reservas-existentes";
    return "/criar-negocio";
  }

  return business.papel === "profissional"
    ? "/profissional/agenda"
    : "/painel";
}

export function getWorkspacePath(session) {
  if (session?.ehAdministrador) {
    return "/admin/trafego-pago";
  }

  return getBusinessWorkspacePath(session);
}

export function getBusinessCreationPath(planSlug) {
  return getPlanIntentPath("/criar-negocio", planSlug);
}

export function getAuthDestination(session, {
  requestedPath = "",
  planSlug = "",
  professionalIntent = false
} = {}) {
  const requested = safeInternalPath(requestedPath);
  const plan = normalizePlanSlug(planSlug);

  if (requested) {
    const requestedPathname = requested.split("?", 1)[0];

    if (!session?.temNegocio && requestedPathname === "/checkout") {
      const query = requested.includes("?")
        ? requested.slice(requested.indexOf("?") + 1)
        : "";
      const requestedPlan = normalizePlanSlug(
        new URLSearchParams(query).get("plano")
      );

      return getBusinessCreationPath(requestedPlan || plan);
    }

    return requested;
  }

  if (plan) {
    if (!session?.temNegocio) {
      return getBusinessCreationPath(plan);
    }

    const ownerBusiness = getBusinessContext(session, "dono");

    if (ownerBusiness) {
      return ownerBusiness.publicado === true
        ? getPlanIntentPath("/checkout", plan)
        : getPlanIntentPath("/painel", plan);
    }
  }

  if (professionalIntent) {
    if (session?.temNegocio || session?.temReservasProfissionaisRestritas) {
      return getBusinessWorkspacePath(session, "dono");
    }
    return getBusinessCreationPath(plan);
  }

  if (
    session?.ehAdministrador ||
    session?.temNegocio ||
    session?.temReservasProfissionaisRestritas
  ) {
    return getWorkspacePath(session);
  }

  return "/";
}
