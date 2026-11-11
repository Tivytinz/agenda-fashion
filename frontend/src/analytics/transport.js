const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// Telemetria usa cookie, preserva keepalive e deixa retry/outbox com o coletor.
// Falha de analytics nunca encerra a sessão nem bloqueia o fluxo da pessoa.
export function postTelemetry(path, payload, { keepalive = false } = {}) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    keepalive,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
