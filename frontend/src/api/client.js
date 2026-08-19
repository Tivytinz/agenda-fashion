import { clearSession } from "../auth/session";
import { readBrowserStorage } from "../utils/browserStorage";

const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const DEFAULT_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...requestOptions
  } = options;
  const headers = new Headers(options.headers || {});
  const token = readBrowserStorage("local", "token");

  headers.set("Accept", "application/json");

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body = options.body;

  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromExternalSignal = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abortFromExternalSignal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  const timeoutId = Number(timeoutMs) > 0
    ? window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, Number(timeoutMs))
    : null;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...requestOptions,
      headers,
      body,
      credentials: requestOptions.credentials || "include",
      signal: controller.signal
    });
  } catch (requestError) {
    if (timedOut) {
      throw new ApiError(
        "A solicitação demorou demais. Verifique sua conexão e tente novamente.",
        408,
        { codigo: "REQUEST_TIMEOUT" }
      );
    }
    throw requestError;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      clearSession({ notify: true });
    }

    throw new ApiError(
      data.erro || data.mensagem || "Não foi possível concluir a solicitação.",
      response.status,
      data
    );
  }

  return data;
}
