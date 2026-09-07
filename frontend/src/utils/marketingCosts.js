import { metricPercentage } from "./marketingMetrics";

const OBJECTIVE_LABELS = {
  profissional: "Aquisição de profissionais",
  cliente: "Aquisição de clientes",
  indefinido: "Objetivo não classificado"
};

const CHANNEL_LABELS = {
  google: "Google Ads",
  meta: "Meta Ads",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  outro: "Outro"
};

const COST_SOURCE_LABELS = {
  google_ads: "Google Ads · automático",
  meta_ads: "Meta Ads · automático",
  manual: "Lançamento manual"
};

export function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatMarketingMoney(value) {
  if (value === null || value === undefined) return "Sem dados";
  const cents = Number(value);
  if (!Number.isFinite(cents)) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(cents / 100);
}

export function formatMarketingDate(value) {
  if (!value) return "Sem data";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function moneyToCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

export function objectiveLabel(value) {
  return OBJECTIVE_LABELS[value] || OBJECTIVE_LABELS.indefinido;
}

export function channelLabel(value) {
  return CHANNEL_LABELS[value] || String(value || "Não identificado");
}

export function costSourceLabel(value) {
  return COST_SOURCE_LABELS[value] || String(value || "Não identificada");
}

export function pluralize(count, singular, plural) {
  return `${count} ${Number(count) === 1 ? singular : plural}`;
}

export function campaignSessionsWithCost(item) {
  const sessions = Math.max(0, Number(item?.sessoes || 0));
  return Math.min(
    sessions,
    Math.max(
      0,
      Number(
        item?.sessoesComCusto ??
          (Number(item?.investimentoCentavos || 0) > 0 ? sessions : 0)
      ) || 0
    )
  );
}

export function campaignCostCoverage(item) {
  return item?.coberturaCustos ?? metricPercentage(
    campaignSessionsWithCost(item),
    item?.sessoes
  );
}

export function campaignConversionsWithCost(item) {
  const conversions = Math.max(
    0,
    Number(item?.agendamentosConcluidos || 0)
  );
  return Math.min(
    conversions,
    Math.max(
      0,
      Number(
        item?.agendamentosConcluidosComCusto ??
          (Number(item?.investimentoCentavos || 0) > 0 ? conversions : 0)
      ) || 0
    )
  );
}
