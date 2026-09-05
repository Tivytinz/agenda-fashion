export const ADMIN_PERIODS = [
  ["today", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["month", "Este mês"],
  ["all", "Todo período"]
];

export const WHATSAPP_PERIODS = [
  ["hoje", "Hoje"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["90", "90 dias"],
  ["total", "Todo período"]
];

const ADMIN_VALUES = new Set(ADMIN_PERIODS.map(([value]) => value));
const WHATSAPP_VALUES = new Set(WHATSAPP_PERIODS.map(([value]) => value));

export function normalizeAdminPeriod(value, fallback = "30") {
  return ADMIN_VALUES.has(String(value || "")) ? String(value) : fallback;
}

export function normalizeWhatsappPeriod(value, fallback = "30") {
  return WHATSAPP_VALUES.has(String(value || "")) ? String(value) : fallback;
}

export function adminPeriodLabel(value) {
  return ADMIN_PERIODS.find(([period]) => period === value)?.[1] || "30 dias";
}

export function setPeriodSearchParam(searchParams, value) {
  const next = new URLSearchParams(searchParams);
  next.set("periodo", value);
  return next;
}
