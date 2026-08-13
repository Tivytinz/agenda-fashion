const AppError = require("../errors/AppError");
const tiktokOAuthService = require("./tiktokOAuthService");

function texto(valor) {
  return String(valor || "").trim();
}

function somenteDigitos(valor) {
  return texto(valor).replace(/\D/g, "");
}

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    texto(valor).toLowerCase()
  );
}

function timeoutMs() {
  const valor = Number(process.env.MARKETING_COST_SYNC_TIMEOUT_MS || 10000);
  return Number.isFinite(valor) && valor >= 1000 && valor <= 30000
    ? Math.trunc(valor)
    : 10000;
}

function config() {
  return {
    enabled: flagAtiva(process.env.TIKTOK_ADS_COSTS_ENABLED),
    advertiserId: somenteDigitos(process.env.TIKTOK_ADVERTISER_ID),
    version: texto(process.env.TIKTOK_API_VERSION) || "v1.3"
  };
}

function exigirConfigBase(valor) {
  if (!valor.enabled || !valor.advertiserId) {
    throw new AppError("Integração com TikTok Ads ainda não está habilitada e configurada.", 409);
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || Number(payload?.code ?? 0) !== 0) {
      const detalhe = texto(payload?.message) || `HTTP ${response.status}`;
      throw new AppError(`Falha ao consultar TikTok Ads: ${detalhe}`, 502);
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError("O TikTok Ads excedeu o tempo de resposta.", 504);
    }
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

function urlTikTok(valor, path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(
    `https://business-api.tiktok.com/open_api/${valor.version}/${cleanPath}`
  );

  for (const [key, item] of Object.entries(params)) {
    if (item !== undefined && item !== null && item !== "") {
      url.searchParams.set(key, String(item));
    }
  }

  return url.toString();
}

async function get(path, params = {}) {
  const valor = config();
  exigirConfigBase(valor);
  const accessToken = await tiktokOAuthService.obterAccessTokenValido();

  return fetchJson(
    urlTikTok(valor, path, params),
    {
      headers: {
        "Access-Token": accessToken,
        "Content-Type": "application/json"
      }
    }
  );
}

function mapearCampanha(row, advertiserId) {
  const id = somenteDigitos(row?.campaign_id);
  if (!id) return null;

  return {
    contaExternaId: advertiserId,
    campanhaExternaId: id,
    campanhaExternaNome: texto(row?.campaign_name),
    status:
      texto(
        row?.operation_status ||
        row?.secondary_status ||
        row?.status
      ) || "UNKNOWN",
    tipo: texto(row?.objective_type || row?.objective) || "UNKNOWN"
  };
}

async function listarCampanhasRaw(filtering) {
  const valor = config();
  exigirConfigBase(valor);
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await get("campaign/get/", {
      advertiser_id: valor.advertiserId,
      page,
      page_size: 100,
      filtering: filtering ? JSON.stringify(filtering) : undefined
    });
    rows.push(...(Array.isArray(payload?.data?.list) ? payload.data.list : []));
    totalPages = Math.max(
      1,
      Number(payload?.data?.page_info?.total_page || 1)
    );
    page += 1;
  } while (page <= totalPages && page <= 20);

  return rows;
}

async function testarConexao() {
  const valor = config();
  exigirConfigBase(valor);
  const payload = await get("advertiser/info/", {
    advertiser_ids: JSON.stringify([valor.advertiserId])
  });
  const account = Array.isArray(payload?.data?.list)
    ? payload.data.list[0]
    : null;
  const advertiserId = somenteDigitos(
    account?.advertiser_id || account?.id
  );

  if (!advertiserId || advertiserId !== valor.advertiserId) {
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
    apiVersion: valor.version
  };
}

async function listarCampanhas() {
  const valor = config();
  const rows = await listarCampanhasRaw();
  return rows
    .map((row) => mapearCampanha(row, valor.advertiserId))
    .filter(Boolean)
    .sort((a, b) =>
      a.campanhaExternaNome.localeCompare(
        b.campanhaExternaNome,
        "pt-BR"
      )
    );
}

async function buscarCampanha(campanhaExternaId) {
  const id = somenteDigitos(campanhaExternaId);
  if (!id) {
    throw new AppError("Informe uma campanha válida do TikTok Ads.", 400);
  }

  const valor = config();
  const rows = await listarCampanhasRaw({ campaign_ids: [id] });
  const campanha = mapearCampanha(rows[0], valor.advertiserId);

  if (!campanha || campanha.campanhaExternaId !== id) {
    throw new AppError(
      "Campanha não encontrada na conta configurada do TikTok Ads.",
      404
    );
  }

  return campanha;
}

async function relatorio({ dataInicio, dataFim }) {
  const valor = config();
  exigirConfigBase(valor);
  const rows = [];
  let page = 1;
  let totalPages = 1;

  do {
    const payload = await get("report/integrated/get/", {
      advertiser_id: valor.advertiserId,
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
    totalPages = Math.max(
      1,
      Number(payload?.data?.page_info?.total_page || 1)
    );
    page += 1;
  } while (page <= totalPages && page <= 20);

  return rows;
}

function paraCentavos(valor) {
  const numero = Number(valor || 0);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.max(0, Math.round(numero * 100));
}

async function listarCustos(periodo) {
  const valor = config();
  const [campanhas, rows] = await Promise.all([
    listarCampanhas(),
    relatorio(periodo)
  ]);
  const nomePorId = new Map(
    campanhas.map((item) => [
      item.campanhaExternaId,
      item.campanhaExternaNome
    ])
  );

  return rows
    .map((row) => {
      const dimensions = row?.dimensions || {};
      const metrics = row?.metrics || {};
      const campaignId = somenteDigitos(
        dimensions.campaign_id || row?.campaign_id
      );
      const dataGasto = texto(
        dimensions.stat_time_day || row?.stat_time_day
      ).slice(0, 10);

      return {
        contaExternaId: valor.advertiserId,
        campanhaExternaId: campaignId,
        campanhaExternaNome: nomePorId.get(campaignId) || "",
        dataGasto,
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

async function status() {
  const valor = config();
  const autorizacao = await tiktokOAuthService.statusAutorizacao();

  return {
    provedor: "tiktok_ads",
    nome: "TikTok Ads",
    habilitado: valor.enabled,
    configurado: Boolean(
      valor.enabled &&
      valor.advertiserId &&
      autorizacao.autorizado
    ),
    contaExternaId: valor.advertiserId || null,
    autorizacao
  };
}

module.exports = {
  status,
  testarConexao,
  listarCampanhas,
  buscarCampanha,
  listarCustos,
  config,
  paraCentavos
};
