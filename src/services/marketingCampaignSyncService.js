const repository = require(
  "../repositories/marketingCostSyncRepository"
);

const PROVIDER_META = Object.freeze({
  google_ads: {
    canal: "google",
    nome: "Google Ads"
  },
  meta_ads: {
    canal: "meta",
    nome: "Meta Ads"
  }
});

function normalizeExternalId(value) {
  return String(value || "")
    .replace(/^act_/i, "")
    .replace(/\D/g, "");
}

function externalKey(item) {
  const accountId = normalizeExternalId(
    item?.contaExternaId ??
      item?.conta_externa_id
  );
  const campaignId = normalizeExternalId(
    item?.campanhaExternaId ??
      item?.campanha_externa_id
  );

  return accountId && campaignId
    ? `${accountId}:${campaignId}`
    : null;
}

function campaignName(provider, item) {
  const meta = PROVIDER_META[provider];
  const externalId = normalizeExternalId(
    item?.campanhaExternaId ??
      item?.campanha_externa_id
  );
  const externalName = String(
    item?.campanhaExternaNome ??
      item?.campanha_externa_nome ??
      ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);

  if (externalName.length >= 2) {
    return externalName;
  }

  return `${meta?.nome || "Mídia paga"} · ${externalId}`.slice(0, 140);
}

function desiredInternalCampaign({
  provider,
  externalCampaign,
  userId,
  active
}) {
  const meta = PROVIDER_META[provider];
  if (!meta) return null;

  const accountId = normalizeExternalId(
    externalCampaign?.contaExternaId ??
      externalCampaign?.conta_externa_id
  );
  const externalId = normalizeExternalId(
    externalCampaign?.campanhaExternaId ??
      externalCampaign?.campanha_externa_id
  );

  if (!accountId || !externalId) {
    return null;
  }

  const numericUserId = Number(userId);

  return {
    nome: campaignName(provider, externalCampaign),
    canal: meta.canal,
    objetivo: "indefinido",
    utmSource: meta.canal,
    utmMedium: "cpc",
    utmCampaign: externalId,
    utmContent: null,
    utmTerm: null,
    destinoPath: "/",
    ativo: active !== false,
    criadoPorUsuarioId:
      Number.isInteger(numericUserId) && numericUserId > 0
        ? numericUserId
        : null,
    provedor: provider,
    contaExternaId: accountId,
    campanhaExternaId: externalId,
    campanhaExternaNome:
      String(
        externalCampaign?.campanhaExternaNome ??
          externalCampaign?.campanha_externa_nome ??
          ""
      ).trim().slice(0, 240) || null
  };
}

function uniqueCandidates({
  externalCampaigns,
  costs,
  isOperational
}) {
  const externalByKey = new Map();
  for (const item of externalCampaigns || []) {
    const key = externalKey(item);
    if (key) externalByKey.set(key, item);
  }

  const candidates = new Map();

  for (const item of externalCampaigns || []) {
    const key = externalKey(item);
    if (!key || !isOperational(item)) continue;
    candidates.set(key, {
      item,
      active: true
    });
  }

  for (const cost of costs || []) {
    const key = externalKey(cost);
    if (!key) continue;
    const external = externalByKey.get(key);
    candidates.set(key, {
      item: external || cost,
      active: external ? isOperational(external) : true
    });
  }

  return [...candidates.entries()];
}

async function reconcileExternalCampaigns({
  provider,
  externalCampaigns,
  costs,
  links,
  userId,
  isOperational
}) {
  if (!PROVIDER_META[provider]) {
    return {
      links: Array.isArray(links) ? links : [],
      importedCampaigns: 0,
      automaticLinks: 0,
      unresolved: 0
    };
  }

  const currentLinks = [...(links || [])];
  const byExternal = new Map(
    currentLinks
      .map((link) => [externalKey(link), link])
      .filter(([key]) => Boolean(key))
  );

  let importedCampaigns = 0;
  let automaticLinks = 0;
  let unresolved = 0;

  for (const [key, candidate] of uniqueCandidates({
    externalCampaigns,
    costs,
    isOperational
  })) {
    if (byExternal.has(key)) continue;

    const desired = desiredInternalCampaign({
      provider,
      externalCampaign: candidate.item,
      userId,
      active: candidate.active
    });

    if (!desired) {
      unresolved += 1;
      continue;
    }

    const result =
      await repository.garantirCampanhaImportadaComVinculo(desired);

    if (!result || result.conflito === true || !result.vinculo) {
      unresolved += 1;
      continue;
    }

    const link = {
      ...result.vinculo,
      objetivo:
        result.campanha?.objetivo ??
        result.vinculo?.objetivo ??
        "indefinido",
      ativo:
        result.campanha?.ativo ??
        result.vinculo?.ativo ??
        true,
      canal:
        result.campanha?.canal ??
        result.vinculo?.canal ??
        PROVIDER_META[provider].canal
    };
    currentLinks.push(link);
    byExternal.set(key, link);

    if (result.campanhaCriada === true) importedCampaigns += 1;
    if (result.vinculoCriado === true) automaticLinks += 1;
  }

  return {
    links: currentLinks,
    importedCampaigns,
    automaticLinks,
    unresolved
  };
}

module.exports = {
  reconcileExternalCampaigns,
  desiredInternalCampaign,
  externalKey,
  normalizeExternalId,
  uniqueCandidates
};
