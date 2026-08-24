const PAID_MEDIA = new Set([
  "cpc",
  "ppc",
  "paid",
  "paid_search",
  "paid_social",
  "paid-social",
  "social_paid",
  "display"
]);

const MISSING_CAMPAIGNS = new Set([
  "",
  "(sem campanha)",
  "sem campanha",
  "organico",
  "orgânico"
]);

export function isMissingCampaignIdentity(value) {
  return MISSING_CAMPAIGNS.has(
    String(value || "")
      .trim()
      .toLocaleLowerCase("pt-BR")
  );
}

export function isPaidTrafficWithoutCampaign(item) {
  const source = String(item?.origem || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
  const medium = String(item?.midia || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return Boolean(
    source &&
    source !== "organico" &&
    source !== "orgânico" &&
    source !== "direct" &&
    PAID_MEDIA.has(medium) &&
    isMissingCampaignIdentity(item?.campanha)
  );
}

export function countPaidSessionsWithoutCampaign(items = []) {
  return items
    .filter(isPaidTrafficWithoutCampaign)
    .reduce(
      (total, item) => total + Number(item?.sessoes || 0),
      0
    );
}

export function managedChannelForSource(value) {
  const source = String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  if (["facebook", "instagram", "meta"].includes(source)) {
    return "meta";
  }
  if (["google", "google_ads", "google-ads"].includes(source)) {
    return "google";
  }
  if (source === "pinterest") return "pinterest";
  if (source === "tiktok") return "tiktok";
  return "";
}
