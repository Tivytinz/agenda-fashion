const AppError = require("../errors/AppError");

const PROVIDERS = Object.freeze({
  pinterest_ads: "Pinterest Ads",
  tiktok_ads: "TikTok Ads"
});

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

function texto(valor) {
  return String(valor || "").trim();
}

function somenteDigitos(valor) {
  return texto(valor).replace(/\D/g, "");
}

function timeoutMs() {
  const valor = Number(process.env.MARKETING_COST_SYNC_TIMEOUT_MS || 10000);
  return Number.isFinite(valor) && valor >= 1000 && valor <= 30000
    ? Math.trunc(valor)
    : 10000;
}

async function fetchJson(url, options = {}, { tiktok = false } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detalhe =
        payload?.message ||
        payload?.error?.message ||
        payload?.error?.status ||
        `HTTP ${response.status}`;
      throw new AppError(`Falha ao consultar plataforma de anúncios: ${detalhe}`, 502);
    }

    if (tiktok && Number(payload?.code ?? 0) !== 0) {
      throw new AppError(
        `Falha ao consultar TikTok Ads: ${texto(payload?.message) || "erro da API"}`,
        502
      );
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError("A plataforma de anúncios excedeu o tempo de resposta.", 504);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

function paraCentavos(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.max(0, Math.round(numero * 100));
}

function microsParaCentavos(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.max(0, Math.round(numero / 10000));
}

function pinterestConfig() {
  const config = {
    enabled: flagAtiva(process.env.PINTEREST_ADS_COSTS_ENABLED),
    accountId: somenteDigitos(process.env.PINTEREST_AD_ACCOUNT_ID),
    accessToken: texto(process.env.PINTEREST_ADS_ACCESS_TOKEN),
    version: texto(process.env.PINTEREST_API_VERSION) || "v5"
  };
  config.configured = Boolean(
    config.enabled && config.accountId && config.accessToken
  );
  return config;
}

function exigirPinterestConfigurado(config) {
  if (!config.configured) {
    throw new AppError("Integração com Pinterest Ads ainda não está configurada.", 409);
  }
}

function pinterestUrl(config, path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`https://api.pinterest.com/${config.version}/${cleanPath}`);

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length > 0) url.searchParams.set(key, value.join(","));
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url;
}

async function pinterestGet(config, path, params = {}) {
  exigirPinterestConfigurado(config);
  return fetchJson(pinterestUrl(config, path, params).toString(), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json"
    }
  });
}

async function pinterestListarPaginas(config, path, params = {}) {
  const items = [];
  let bookmark = "";
  let paginas = 0;

  do {
    const payload = await pinterestGet(config, path, {
      ...params,
      page_size: params.page_size || 250,
      bookmark: bookmark || undefined
    });
    items.push(...(Array.isArray(payload?.items) ? payload.items : []));
    bookmark = texto(payload?.bookmark);
    paginas += 1;
  } while (bookmark && paginas < 20);

  return items;
}

function mapearPinterestCampanha(row, accountId) {
  const id = somenteDigitos(row?.id);
  if (!id) return null;
  return {
    contaExternaId: somenteDigitos(row?.ad_account_id) || accountId,
    campanhaExternaId: id,
    campanhaExternaNome: texto(row?.name),
    status: texto(row?.status) || "UNKNOWN",
    tipo: texto(row?.objective_type) || "UNKNOWN"
  };
}

async function testarPinterestConexao() {
  const config = pinterestConfig();
  const account = await pinterestGet(config, `ad_accounts/${config.accountId}`);
  const accountId = somenteDigitos(account?.id);

  if (!accountId) {
    throw new AppError("Pinterest Ads respondeu sem identificar a conta configurada.", 502);
  }
  if (accountId !== config.accountId) {
    throw new AppError(
      "A conta retornada pelo Pinterest Ads não corresponde ao Ad Account ID configurado.",
      502
    );
  }

  return {
    provedor: "pinterest_ads",
    conectado: true,
    contaExternaId: accountId,
    nomeConta: texto(account?.name) || null,
    moeda: texto(account?.currency) || null,
    fusoHorario: texto(account?.timezone || account?.timezone_name) || null,
    apiVersion: config.version
  };
}

async function listarPinterestCampanhas() {
  const config = pinterestConfig();
  const rows = await pinterestListarPaginas(
    config,
    `ad_accounts/${config.accountId}/campaigns`
  );

  return rows
    .map((row) => mapearPinterestCampanha(row, config.accountId))
    .filter((item) => item && item.status !== "ARCHIVED")
    .sort((a, b) => a.campanhaExternaNome.localeCompare(b.campanhaExternaNome, "pt-BR"));
}

async function buscarPinterestCampanha(campanhaExternaId) {
  const id = somenteDigitos(campanhaExternaId);
  if (!id) {
    throw new AppError("Informe uma campanha válida do Pinterest Ads.", 400);
  }

  const config = pinterestConfig();
  const row = await pinterestGet(
    config,
    `ad_accounts/${config.accountId}/campaigns/${id}`
  );
  const campanha = mapearPinterestCampanha(row, config.accountId);

  if (
    !campanha ||
    campanha.contaExternaId !== config.accountId ||
    campanha.status === "ARCHIVED"
  ) {
    throw new AppError(
      "Campanha não encontrada na conta configurada do Pinterest Ads.",
      404
    );
  }

  return campanha;
}

function linhasPinterestAnalytics(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function listarPinterest({ dataInicio, dataFim }) {
  const config = pinterestConfig();
  exigirPinterestConfigurado(config);

  const campanhas = await listarPinterestCampanhas();
  if (campanhas.length === 0) return [];

  const nomePorId = new Map(
    campanhas.map((item) => [item.campanhaExternaId, item.campanhaExternaNome])
  );
  const resultado = [];

  for (let offset = 0; offset < campanhas.length; offset += 100) {
    const ids = campanhas
      .slice(offset, offset + 100)
      .map((item) => item.campanhaExternaId);

    const payload = await pinterestGet(
      config,
      `ad_accounts/${config.accountId}/campaigns/analytics`,
      {
        start_date: dataInicio,
        end_date: dataFim,
        campaign_ids: ids,
        columns: ["CAMPAIGN_ID", "SPEND_IN_MICRO_DOLLAR"],
        granularity: "DAY"
      }
    );

    for (const row of linhasPinterestAnalytics(payload)) {
      const campaignId = somenteDigitos(
        row?.CAMPAIGN_ID || row?.campaign_id || row?.metrics?.CAMPAIGN_ID
      );
      const data = texto(row?.DATE || row?.date || row?.start_date).slice(0, 10);
      const valorCentavos = microsParaCentavos(
        row?.SPEND_IN_MICRO_DOLLAR ?? row?.metrics?.SPEND_IN_MICRO_DOLLAR
      );

      if (campaignId && /^\d{4}-\d{2}-\d{2}$/.test(data) && valorCentavos > 0) {
        resultado.push({
          contaExternaId: config.accountId,
          campanhaExternaId: campaignId,
          campanhaExternaNome: nomePorId.get(campaignId) || "",
          dataGasto: data,
          valorCentavos
        });
      }
    }
  }

  return resultado;
}

function tiktokConfig() {
  const config = {
    enabled: flagAtiva(process.env.TIKTOK_ADS_COSTS_ENABLED),
    advertiserId: somenteDigitos(process.env.TIKTOK_ADVERTISER_ID),
    accessToken: texto(process.env.TIKTOK_ADS_ACCESS_TOKEN),
    version: texto(process.env.TIKTOK_API_VERSION) || "v1.3"
  };
  config.configured = Boolean(
    config.enabled && config.advertiserId && config.accessToken
  );
  return config;
}

function exigirTikTokConfigurado(config) {
  if (!config.configured) {
    throw new AppError("Integração com TikTok Ads ainda não está configurada.", 409);
  }
}

function tiktokUrl(config, path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(
    `https://business-api.tiktok.com/open_api/${config.version}/${cleanPath}`
  );
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function tiktokGet(config, path, params = {}) {
  exigirTikTokConfigurado(config);
  return fetchJson(
    tiktokUrl(config, path, params).toString(),
    {
      headers: {
        "Access-Token": config.accessToken,
        "Content-Type": "application/json"
      }
    },
    { tiktok: true }
  );
}

function mapearTikTokCampanha(row, advertiserId) {
  const id = somenteDigitos(row?.campaign_id);
  if (!id) return null;
  return {
    contaExternaId: advertiserId,
    campanhaExternaId: id,
    campanhaExternaNome: texto(row?.campaign_name),
    status: texto(row?.operation_status || row?.secondary_status || row?.status) || "UNKNOWN",
    tipo: texto(row?.objective_type || row?.objective) || "UNKNOWN"
  };
}

async function tiktokListarCampanhasRaw(config, filtering) {
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await tiktokGet(config, "campaign/get/", {
      advertiser_id: config.advertiserId,
      page,
      page_size: 100,
      filtering: filtering ? JSON.stringify(filtering) : undefined
    });
    rows.push(...(Array.isArray(payload?.data?.list) ? payload.data.list : []));
    const pageInfo = payload?.data?.page_info || {};
    totalPages = Math.max(1, Number(pageInfo.total_page || pageInfo.totalPage || 1));
    page += 1;
  } while (page <= totalPages && page <= 20);

  return rows;
}

async function testarTikTokConexao() {
  const config = tiktokConfig();
  const payload = await tiktokGet(config, "advertiser/info/", {
    advertiser_ids: JSON.stringify([config.advertiserId])
  });
  const account = Array.isArray(payload?.data?.list)
    ? payload.data.list[0]
    : payload?.data;
  const advertiserId = somenteDigitos(
    account?.advertiser_id || account?.id
  );

  if (!advertiserId) {
    throw new AppError("TikTok Ads respondeu sem identificar a conta configurada.", 502);
  }
  if (advertiserId !== config.advertiserId) {
    throw new AppError(
      "A conta retornada pelo TikTok Ads não corresponde ao Advertiser ID configurado.",
      502
    );
  }

  return {
    provedor: "tiktok_ads",
    conectado: true,
    contaExternaId: advertiserId,
    nomeConta: texto(account?.advertiser_name || account?.name) || null,
    moeda: texto(account?.currency) || null,
    fusoHorario: texto(account?.timezone || account?.timezone_name) || null,
    apiVersion: config.version
  };
}

async function listarTikTokCampanhas() {
  const config = tiktokConfig();
  exigirTikTokConfigurado(config);
  const rows = await tiktokListarCampanhasRaw(config);
  return rows
    .map((row) => mapearTikTokCampanha(row, config.advertiserId))
    .filter(Boolean)
    .sort((a, b) => a.campanhaExternaNome.localeCompare(b.campanhaExternaNome, "pt-BR"));
}

async function buscarTikTokCampanha(campanhaExternaId) {
  const id = somenteDigitos(campanhaExternaId);
  if (!id) {
    throw new AppError("Informe uma campanha válida do TikTok Ads.", 400);
  }

  const config = tiktokConfig();
  exigirTikTokConfigurado(config);
  const rows = await tiktokListarCampanhasRaw(config, { campaign_ids: [id] });
  const campanha = mapearTikTokCampanha(rows[0], config.advertiserId);

  if (!campanha || campanha.campanhaExternaId !== id) {
    throw new AppError(
      "Campanha não encontrada na conta configurada do TikTok Ads.",
      404
    );
  }

  return campanha;
}

async function tiktokRelatorio(config, { dataInicio, dataFim }) {
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await tiktokGet(config, "report/integrated/get/", {
      advertiser_id: config.advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify(["campaign_id", "stat_time_day"]),
      metrics: JSON.stringify(["spend"]),
      start_date: dataInicio,
      end_date: dataFim,
      page,
      page_size: 1000
    });
    rows.push(...(Array.isArray(payload?.data?.list) ? payload.data.list : []));
    const pageInfo = payload?.data?.page_info || {};
    totalPages = Math.max(1, Number(pageInfo.total_page || pageInfo.totalPage || 1));
    page += 1;
  } while (page <= totalPages && page <= 20);

  return rows;
}

async function listarTikTok({ dataInicio, dataFim }) {
  const config = tiktokConfig();
  exigirTikTokConfigurado(config);

  const [campaigns, reportRows] = await Promise.all([
    listarTikTokCampanhas(),
    tiktokRelatorio(config, { dataInicio, dataFim })
  ]);
  const nomePorId = new Map(
    campaigns.map((item) => [item.campanhaExternaId, item.campanhaExternaNome])
  );

  return reportRows
    .map((row) => {
      const dimensions = row?.dimensions || {};
      const metrics = row?.metrics || {};
      const campaignId = somenteDigitos(
        dimensions.campaign_id || row?.campaign_id
      );
      const data = texto(
        dimensions.stat_time_day || row?.stat_time_day
      ).slice(0, 10);
      return {
        contaExternaId: config.advertiserId,
        campanhaExternaId: campaignId,
        campanhaExternaNome: nomePorId.get(campaignId) || "",
        dataGasto: data,
        valorCentavos: paraCentavos(metrics.spend ?? row?.spend)
      };
    })
    .filter(
      (item) =>
        item.campanhaExternaId &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.dataGasto) &&
        item.valorCentavos > 0
    );
}

function status() {
  const pinterest = pinterestConfig();
  const tiktok = tiktokConfig();
  return [
    {
      provedor: "pinterest_ads",
      nome: PROVIDERS.pinterest_ads,
      habilitado: pinterest.enabled,
      configurado: pinterest.configured,
      contaExternaId: pinterest.accountId || null
    },
    {
      provedor: "tiktok_ads",
      nome: PROVIDERS.tiktok_ads,
      habilitado: tiktok.enabled,
      configurado: tiktok.configured,
      contaExternaId: tiktok.advertiserId || null
    }
  ];
}

async function listarCustos(provedor, periodo) {
  if (provedor === "pinterest_ads") return listarPinterest(periodo);
  if (provedor === "tiktok_ads") return listarTikTok(periodo);
  throw new AppError("Provedor visual de custos inválido.", 400);
}

async function listarCampanhas(provedor) {
  if (provedor === "pinterest_ads") return listarPinterestCampanhas();
  if (provedor === "tiktok_ads") return listarTikTokCampanhas();
  throw new AppError("Provedor visual de campanhas inválido.", 400);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  if (provedor === "pinterest_ads") {
    return buscarPinterestCampanha(campanhaExternaId);
  }
  if (provedor === "tiktok_ads") {
    return buscarTikTokCampanha(campanhaExternaId);
  }
  throw new AppError("Provedor visual de campanhas inválido.", 400);
}

async function testarConexao(provedor) {
  if (provedor === "pinterest_ads") return testarPinterestConexao();
  if (provedor === "tiktok_ads") return testarTikTokConexao();
  throw new AppError("Provedor visual de conexão inválido.", 400);
}

module.exports = {
  PROVIDERS,
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao,
  pinterestConfig,
  tiktokConfig,
  microsParaCentavos,
  paraCentavos
};
