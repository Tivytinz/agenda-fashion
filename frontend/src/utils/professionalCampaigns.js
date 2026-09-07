export function formatCampaignMoney(value) {
  if (value === null || value === undefined) return "Sem dados";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sem dados";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(number / 100);
}

export function formatCampaignRoas(value) {
  if (value === null || value === undefined) return "Sem dados";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sem dados";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number)}x`;
}

export function campaignLabel(item) {
  const campaign = String(item?.campanha || "").trim();
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  if (classification === "sem_evidencia") {
    return "Origem não identificada";
  }

  if (
    source === "google" &&
    medium === "cpc" &&
    campaign.toLowerCase() === "google_ads_profissionais"
  ) {
    return "Google Ads · Aquisição de profissionais";
  }

  if (
    !campaign ||
    ["organico", "orgânico", "(sem campanha)", "sem campanha"]
      .includes(campaign.toLowerCase())
  ) {
    if (source === "organico" && (!medium || medium === "none")) {
      return "Orgânico / sem campanha";
    }
    return "Tráfego sem UTM de campanha";
  }

  return campaign;
}

export function campaignKey(item) {
  return `${item?.classificacaoAtribuicao || "sem_classificacao"}-${item?.origem}-${item?.midia}-${item?.campanha}`;
}

export function utmIdentityLabel(item) {
  return [
    item?.origem || "organico",
    item?.midia || "none",
    item?.campanha || "organico"
  ].join(" / ");
}

export function decisionBadgeClass(code) {
  const safeCode = String(code || "sem_dados").replace(/[^a-z_]/g, "");
  return `admin-status-badge admin-decision-badge is-${safeCode}`;
}

export function campaignSourceMeta(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  if (classification === "sem_evidencia") {
    return { code: "outro", label: "Origem não identificada" };
  }

  if (source === "google") return { code: "google", label: "Google Ads" };
  if (["meta", "facebook", "instagram"].includes(source)) {
    return { code: "meta", label: "Meta Ads" };
  }
  if (source === "pinterest") return { code: "pinterest", label: "Pinterest" };
  if (source === "tiktok") return { code: "tiktok", label: "TikTok" };
  if (source === "organico") return { code: "organico", label: "Orgânico" };

  return {
    code: "outro",
    label: source
      ? source.charAt(0).toUpperCase() + source.slice(1)
      : "Origem não identificada"
  };
}

export function campaignMediumLabel(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  if (source === "organico" && (!medium || medium === "none")) return "";
  return medium ? medium.toUpperCase() : "";
}

export function isOrganicCampaign(item) {
  const source = String(item?.origem || "").trim().toLowerCase();
  const medium = String(item?.midia || "").trim().toLowerCase();
  const classification = String(
    item?.classificacaoAtribuicao || ""
  ).trim().toLowerCase();

  return classification === "organico" || (
    !classification &&
    source === "organico" &&
    (!medium || medium === "none")
  );
}

export function decisionSignalLabel(confidence) {
  if (confidence === "operacional") return "Sinal operacional";
  if (confidence === "bloqueada") return "Decisão bloqueada";
  return "Base ainda insuficiente";
}
