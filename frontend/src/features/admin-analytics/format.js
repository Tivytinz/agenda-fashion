export function number(value) {
  const converted = Number(value);
  return Number.isFinite(converted) ? converted : 0;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(number(value));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number(value));
}

export function formatCentavos(value) {
  if (value === null || value === undefined) return "—";
  return formatCurrency(number(value) / 100);
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(number(value))}%`;
}

export function formatSeconds(value) {
  if (value === null || value === undefined) return "—";
  const seconds = number(value);
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return remaining > 0 ? `${minutes}min ${remaining}s` : `${minutes}min`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(date);
}
