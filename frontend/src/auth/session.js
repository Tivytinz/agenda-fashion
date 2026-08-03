const SESSION_KEYS = ["token", "usuario", "negocio"];
export const SESSION_CLEARED_EVENT = "agenda-fashion:session-cleared";

export function saveSession(result) {
  if (!result?.token) {
    return;
  }

  localStorage.setItem("token", result.token);

  if (result.usuario) {
    localStorage.setItem("usuario", JSON.stringify(result.usuario));
  }
}

export function clearSession({ notify = false } = {}) {
  SESSION_KEYS.forEach((key) => localStorage.removeItem(key));

  if (notify && typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}

export function hasSession() {
  return Boolean(localStorage.getItem("token"));
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
}

export function getWorkspacePath(session) {
  if (!session?.temNegocio) {
    return "/criar-negocio";
  }

  return session.negocio?.papel === "profissional"
    ? "/profissional/agenda"
    : "/painel";
}
