import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage
} from "../utils/browserStorage";

const SESSION_KEYS = ["token", "usuario", "negocio"];
export const SESSION_CLEARED_EVENT = "agenda-fashion:session-cleared";

export function saveSession(result) {
  if (!result?.token) {
    return;
  }

  writeBrowserStorage("local", "token", result.token);

  if (result.usuario) {
    writeBrowserStorage("local", "usuario", JSON.stringify(result.usuario));
  }
}

export function clearSession({ notify = false } = {}) {
  SESSION_KEYS.forEach((key) => removeBrowserStorage("local", key));

  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}

export function hasSession() {
  return Boolean(readBrowserStorage("local", "token"));
}

export function getStoredUser() {
  try {
    return JSON.parse(readBrowserStorage("local", "usuario") || "null");
  } catch {
    return null;
  }
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

export function getBusinessWorkspacePath(session) {
  if (!session?.temNegocio) {
    return "/criar-negocio";
  }

  return session.negocio?.papel === "profissional"
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
  const plan = normalizePlanSlug(planSlug);
  return plan
    ? `/criar-negocio?plano=${encodeURIComponent(plan)}`
    : "/criar-negocio";
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

    if (session.negocio?.papel === "dono") {
      return `/checkout?plano=${encodeURIComponent(plan)}`;
    }
  }

  return getWorkspacePath(session);
}
