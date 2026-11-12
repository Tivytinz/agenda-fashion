// Códigos fixos apenas: nunca usar mensagem, corpo ou dados do usuário em analytics.
export const SIGNUP_REQUEST_REASONS = Object.freeze([
  "conflict",
  "invalid_request",
  "auth_rejected",
  "rate_limited",
  "timeout",
  "network_error",
  "server_error",
  "unknown"
]);

export function classifyProfessionalSignupRequestError(error) {
  if (error?.name === "AbortError") return null;
  const status = Number(error?.status);
  if (error?.data?.codigo === "REQUEST_TIMEOUT" || status === 408) return "timeout";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 401 || status === 403) return "auth_rejected";
  if (status === 429) return "rate_limited";
  if (status >= 500 && status <= 599) return "server_error";
  if (error?.name === "TypeError") return "network_error";
  return "unknown";
}
