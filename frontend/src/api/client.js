import { clearSession, getSessionRequestGeneration } from "../auth/session";
import { readBrowserStorage } from "../utils/browserStorage";
import { ApiError } from "./errors";
import { DEFAULT_TIMEOUT_MS, withRequestLifecycle } from "./requestLifecycle";

export { ApiError } from "./errors";
const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

async function legacyFetch(path, options, request) {
  request.throwIfAborted();
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", signal: request.signal });
  request.throwIfAborted();
  return response;
}

async function legacyJson(response, request) {
  let data;
  try { data = await response.json(); }
  catch (error) {
    request.throwIfAborted();
    if (error?.name === "AbortError") throw error;
    data = {};
  }
  request.throwIfAborted();
  return data;
}

async function hasValidCookieSession(request) {
  const response = await legacyFetch("/minha-sessao", { headers: { Accept: "application/json" } }, request);
  if (response.ok) return true;
  if (response.status === 401 || response.status === 403) return false;
  const data = await legacyJson(response, request);
  throw new ApiError(data?.erro || data?.mensagem || "Não foi possível validar a sessão atual antes da migração.", response.status, data);
}

function requestLegacyMigration(token, request) {
  return legacyFetch("/auth/migrar-sessao-legada", {
    method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
  }, request);
}

async function resolveLegacyCookieConflict(response, request) {
  let cookiePresent = response.status === 409;
  if (response.status === 200) {
    const data = await legacyJson(response, request);
    cookiePresent = data?.codigo === "COOKIE_SESSAO_PRESENTE";
  }
  if (!cookiePresent) return { handled: false };
  if (await hasValidCookieSession(request)) {
    return { handled: true, result: { attempted: true, migrated: false, alreadyCookie: true } };
  }
  return { handled: true, retry: true };
}

async function performLegacyMigration(token, request) {
  // Cookie HttpOnly válido é a autoridade, mesmo se o Bearer for de outra conta.
  if (await hasValidCookieSession(request)) return { attempted: true, migrated: false, alreadyCookie: true };
  let response = await requestLegacyMigration(token, request);
  let conflict = await resolveLegacyCookieConflict(response, request);
  if (conflict.result) return conflict.result;
  if (conflict.retry) {
    // Uma única repetição compatível com backends legados, dentro do mesmo prazo.
    response = await requestLegacyMigration(token, request);
    conflict = await resolveLegacyCookieConflict(response, request);
    if (conflict.result) return conflict.result;
    if (conflict.retry) throw new ApiError("Não foi possível estabilizar a sessão atual antes da migração.", 409, { codigo: "COOKIE_SESSAO_PRESENTE" });
  }
  if (response.ok) return { attempted: true, migrated: true };
  if (response.status === 401 || response.status === 403) {
    if (await hasValidCookieSession(request)) return { attempted: true, migrated: false, alreadyCookie: true };
    return { attempted: true, migrated: false, invalid: true };
  }
  const data = await legacyJson(response, request);
  throw new ApiError(data?.erro || data?.mensagem || "Não foi possível migrar a sessão antiga.", response.status, data);
}

export async function migrateLegacySession({ signal, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const token = readBrowserStorage("local", "token");
  if (!token) return { attempted: false, migrated: false };
  // Não altera storage; só o provider confirma a migração ou a invalidação.
  return withRequestLifecycle(request => performLegacyMigration(token, request), { signal, timeoutMs });
}

export async function apiRequest(path, options = {}) {
  const {
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    clearSessionOnUnauthorized = true,
    ...requestOptions
  } = options;
  const sessionGeneration = getSessionRequestGeneration();
  const headers = new Headers(options.headers || {});

  headers.set("Accept", "application/json");

  let body = options.body;

  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  return withRequestLifecycle(async ({ signal, throwIfAborted }) => {
    throwIfAborted();
    const response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      body,
      credentials: requestOptions.credentials || "include",
      signal
    });
    throwIfAborted();
    const noBody = response.status === 204 || response.status === 205
      || String(requestOptions.method || "GET").toUpperCase() === "HEAD";
    const data = noBody ? {} : await response.json().catch((error) => {
      throwIfAborted();
      if (error?.name === "AbortError") throw error;
      // Um erro HTTP continua sendo erro mesmo sem JSON utilizável. Em 2xx,
      // um corpo incompleto/inválido nunca confirma uma leitura ou gravação.
      if (!response.ok) return {};
      throw new ApiError(
        "Não foi possível confirmar a resposta do servidor. Atualize os dados antes de tentar novamente.",
        502,
        { codigo: "INVALID_RESPONSE", statusOriginal: response.status }
      );
    });
    // Nenhuma resposta cancelada pode produzir efeitos locais tardios.
    throwIfAborted();
    if (!response.ok) {
      if (response.status === 401 && clearSessionOnUnauthorized
        && sessionGeneration === getSessionRequestGeneration()) {
        clearSession({ notify: true });
      }
      throw new ApiError(
        data?.erro || data?.mensagem || "Não foi possível concluir a solicitação.",
        response.status,
        data
      );
    }
    return data;
  }, { signal: externalSignal, timeoutMs });
}
