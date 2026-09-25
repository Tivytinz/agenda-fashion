import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const SESSION_ACTIVE_KEY = "session_active";
const SESSION_KEYS = ["token", SESSION_ACTIVE_KEY, "usuario", "negocio"];
export const SESSION_CLEARED_EVENT = "agenda-fashion:session-cleared";

export function saveSession(result) {
  removeBrowserStorage("local", "token");

  if (!result?.usuario) {
    return;
  }

  writeBrowserStorage("local", SESSION_ACTIVE_KEY, "1");
  removeBrowserStorage("local", "usuario");
  removeBrowserStorage("local", "negocio");
}

export function clearSession({ notify = false } = {}) {
  SESSION_KEYS.forEach((key) => removeBrowserStorage("local", key));

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
  planSlug = ""
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

  return getWorkspacePath(session);
}
