export function safeMetricNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function metricPercentage(part, total, digits = 1) {
  const normalizedPart = safeMetricNumber(part);
  const normalizedTotal = safeMetricNumber(total);

  if (normalizedTotal <= 0) return null;

  return Number(
    ((normalizedPart / normalizedTotal) * 100).toFixed(digits)
  );
}

export function paidAttributionQuality({
  official = 0,
  missingCampaign = 0,
  unofficialIdentity = 0
} = {}) {
  const officialSessions = Math.max(0, safeMetricNumber(official));
  const missingSessions = Math.max(0, safeMetricNumber(missingCampaign));
  const unofficialSessions = Math.max(0, safeMetricNumber(unofficialIdentity));
  const pendingSessions = missingSessions + unofficialSessions;
  const detectedPaidSessions = officialSessions + pendingSessions;

  return {
    officialSessions,
    pendingSessions,
    detectedPaidSessions,
    coverage: metricPercentage(officialSessions, detectedPaidSessions)
  };
}

export function formatMetricPercent(value) {
  if (value === null || value === undefined) return "Sem base";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sem base";

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(number)}%`;
}
