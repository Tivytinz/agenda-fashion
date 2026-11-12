import { getPlanIntentPath } from "../../auth/session";

export function safeServiceId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const input = String(value);
  if (!/^[1-9][0-9]{0,14}$/.test(input)) return null;
  const id = Number(input);
  return Number.isSafeInteger(id) ? id : null;
}

function route(path, planSlug, serviceId) {
  const params = new URLSearchParams();
  const id = safeServiceId(serviceId);
  if (id) params.set("servico_retorno", String(id));
  const separator = path.includes("?") ? "&" : "?";
  const withService = id ? `${path}${separator}${params.toString()}` : path;
  return getPlanIntentPath(withService, planSlug);
}

export function onboardingBusinessPath(planSlug, serviceId) {
  return route("/painel/negocio?onboarding=revisao-negocio", planSlug, serviceId);
}
export function onboardingAccountPath(planSlug, serviceId) {
  return route("/cadastro?tipo=profissional&onboarding=revisao-conta", planSlug, serviceId);
}
export function onboardingServicePath(planSlug, serviceId) {
  const id = safeServiceId(serviceId);
  return id
    ? getPlanIntentPath(`/painel/servicos/${id}/editar?onboarding=revisao-servico`, planSlug)
    : getPlanIntentPath("/painel/servicos/novo?onboarding=servico", planSlug);
}
export function onboardingSchedulePath(planSlug, serviceId) {
  return route("/painel/horarios", planSlug, serviceId);
}
