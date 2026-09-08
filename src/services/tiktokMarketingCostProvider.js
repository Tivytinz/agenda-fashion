const AppError = require("../errors/AppError");
const oauthService = require("./tiktokMarketingOAuthService");

const PROVIDER_ID = "tiktok_ads";
const PROVIDER_NAME = "TikTok Ads";
const BASE_URL = "https://business-api.tiktok.com/open_api";
const DEFAULT_VERSION = "v1.3";
const DEFAULT_TIMEOUT_MS = 10000;
const PAGE_SIZE = 100;

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(
    String(process.env[name] || "").trim().toLowerCase()
  );
}

function normalizarId(value) {
  return String(value || "").replace(/\D/g, "");
}

function config() {
  const advertiserId = normalizarId(
    process.env.TIKTOK_ADVERTISER_ID
  );
  const apiVersion = String(
    process.env.TIKTOK_API_VERSION || DEFAULT_VERSION
  ).trim() || DEFAULT_VERSION;
  const timeout = Number(
    process.env.MARKETING_COST_SYNC_TIMEOUT_MS || DEFAULT_TIMEOUT_MS
  );

  return {
    enabled: envFlag("TIKTOK_ADS_COSTS_ENABLED"),
    advertiserId,
    apiVersion,
    timeoutMs:
      Number.isFinite(timeout) && timeout > 0
        ? Math.min(timeout, 30000)
        : DEFAULT_TIMEOUT_MS
  };
}

async function status() {
  const atual = config();
  const autorizacao = await oauthService.statusAutorizacao();

  return {
    provedor: PROVIDER_ID,
    nome: PROVIDER_NAME,
    habilitado: atual.enabled,
    configurado: Boolean(
      atual.enabled &&
        atual.advertiserId &&
        autorizacao.disponivel &&
        autorizacao.autorizado
    ),
    contaExternaId: atual.advertiserId || null,
    requerAutorizacao: true,
    autorizacao
  };
}

async function exigirConfigurado() {
  const atual = config();
  if (!atual.enabled) {
    throw new AppError(
      "Importação de custos do TikTok Ads está desativada.",
      409
    );
  }
  if (!atual.advertiserId) {
    throw new AppError(
      "TIKTOK_ADVERTISER_ID não está configurado.",
      409
    );
  }

  const accessToken = await oauthService.obterAccessToken();
  return {
    ...atual,
    accessToken
  };
}

async function jsonSeguro(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function mensagemApi(payload, fallback) {
  const mensagem = String(payload?.message || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 180);
  return mensagem || fallback;
}

async function tiktokGet(path, params = {}) {
  const atual = await exigirConfigurado();
  const url = new URL(
    `${BASE_URL}/${atual.apiVersion}/${String(path).replace(/^\/+|\/+$/g, "")}/`
  );

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    atual.timeoutMs
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Access-Token": atual.accessToken
      },
      signal: controller.signal
    });
    const payload = await jsonSeguro(response);

    if (!response.ok) {
      throw new AppError(
        `TikTok Ads indisponível: ${mensagemApi(payload, `HTTP ${response.status}`)}.`,
        502
      );
    }
    if (Number(payload?.code) !== 0) {
      throw new AppError(
        `TikTok Ads recusou a consulta: ${mensagemApi(payload, "erro da plataforma")}.`,
        502
      );
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError(
        "TikTok Ads demorou demais para responder.",
        504
      );
    }
    throw erro;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buscarConta() {
  const atual = config();
  const payload = await tiktokGet("advertiser/info", {
    advertiser_ids: JSON.stringify([atual.advertiserId]),
    fields: JSON.stringify([
      "advertiser_id",
      "name",
      "currency",
      "timezone",
      "status"
    ])
  });
  const rows = Array.isArray(payload?.data?.list)
    ? payload.data.list
    : [];
  const conta = rows.find(
    (item) => normalizarId(item?.advertiser_id) === atual.advertiserId
  );

  if (!conta) {
    throw new AppError(
      "TikTok Ads respondeu sem a conta configurada.",
      502
    );
  }

  return conta;
}

function mapearCampanha(item, advertiserId) {
  const id = normalizarId(item?.campaign_id);
  if (!id) return null;

  return {
    contaExternaId: advertiserId,
    campanhaExternaId: id,
    campanhaExternaNome: String(item?.campaign_name || "").trim(),
    status: String(
      item?.operation_status ||
        item?.campaign_status ||
        item?.status ||
        "UNKNOWN"
    ),
    tipo: String(item?.objective_type || "UNKNOWN")
  };
}

async function listarCampanhas() {
  const atual = config();
  const rows = [];
  let page = 1;

  while (page <= 100) {
    const payload = await tiktokGet("campaign/get", {
      advertiser_id: atual.advertiserId,
      fields: JSON.stringify([
        "campaign_id",
        "campaign_name",
        "operation_status",
        "objective_type"
      ]),
      page,
      page_size: PAGE_SIZE
    });
    const list = Array.isArray(payload?.data?.list)
      ? payload.data.list
      : [];
    rows.push(...list);

    const pageInfo = payload?.data?.page_info || {};
    const totalPage = Number(pageInfo?.total_page || 0);
    if (
      list.length < PAGE_SIZE ||
      (Number.isFinite(totalPage) && totalPage > 0 && page >= totalPage)
    ) {
      break;
    }
    page += 1;
  }

  if (page > 100) {
    throw new AppError(
      "TikTok Ads devolveu mais páginas de campanhas do que o limite seguro.",
      502
    );
  }

  return rows
    .map((item) => mapearCampanha(item, atual.advertiserId))
    .filter(Boolean)
    .sort((a, b) =>
      a.campanhaExternaNome.localeCompare(
        b.campanhaExternaNome,
        "pt-BR"
      )
    );
}

async function buscarCampanha(campanhaExternaId) {
  const id = normalizarId(campanhaExternaId);
  if (!id) {
    throw new AppError("Informe uma campanha válida do TikTok Ads.", 400);
  }

  const campanhas = await listarCampanhas();
  const campanha = campanhas.find(
    (item) => item.campanhaExternaId === id
  );
  if (!campanha) {
    throw new AppError(
      "Campanha não encontrada na conta configurada do TikTok Ads.",
      404
    );
  }
  return campanha;
}

async function listarCustos({ dataInicio, dataFim }) {
  const atual = config();
  const rows = [];
  let page = 1;

  while (page <= 100) {
    const payload = await tiktokGet("report/integrated/get", {
      advertiser_id: atual.advertiserId,
      service_type: "AUCTION",
      report_type: "BASIC",
      data_level: "AUCTION_CAMPAIGN",
      dimensions: JSON.stringify([
        "campaign_id",
        "stat_time_day"
      ]),
      metrics: JSON.stringify([
        "campaign_name",
        "spend"
      ]),
      start_date: dataInicio,
      end_date: dataFim,
      page,
      page_size: PAGE_SIZE
    });
    const list = Array.isArray(payload?.data?.list)
      ? payload.data.list
      : [];
    rows.push(...list);

    const pageInfo = payload?.data?.page_info || {};
    const totalPage = Number(pageInfo?.total_page || 0);
    if (
      list.length < PAGE_SIZE ||
      (Number.isFinite(totalPage) && totalPage > 0 && page >= totalPage)
    ) {
      break;
    }
    page += 1;
  }

  if (page > 100) {
    throw new AppError(
      "TikTok Ads devolveu mais páginas de custos do que o limite seguro.",
      502
    );
  }

  return rows
    .map((item) => {
      const dimensions = item?.dimensions || {};
      const metrics = item?.metrics || {};
      const campaignId = normalizarId(dimensions?.campaign_id);
      const date = String(dimensions?.stat_time_day || "").slice(0, 10);
      const spend = Number(metrics?.spend || 0);

      if (
        !campaignId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(spend) ||
        spend < 0
      ) {
        return null;
      }

      return {
        contaExternaId: atual.advertiserId,
        campanhaExternaId: campaignId,
        campanhaExternaNome: String(metrics?.campaign_name || "").trim(),
        dataGasto: date,
        valorCentavos: Math.round(spend * 100)
      };
    })
    .filter((item) => item && item.valorCentavos > 0);
}

async function testarConexao() {
  const atual = config();
  const conta = await buscarConta();
  const returnedId = normalizarId(conta?.advertiser_id);

  if (!returnedId || returnedId !== atual.advertiserId) {
    throw new AppError(
      "A conta retornada pelo TikTok Ads não corresponde ao Advertiser ID configurado.",
      502
    );
  }

  return {
    provedor: PROVIDER_ID,
    conectado: true,
    contaExternaId: returnedId,
    nomeConta: String(conta?.name || "").trim() || null,
    moeda: String(conta?.currency || "").trim() || null,
    fusoHorario: String(conta?.timezone || "").trim() || null,
    apiVersion: atual.apiVersion
  };
}

module.exports = {
  PROVIDER_ID,
  PROVIDER_NAME,
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao,
  config,
  mapearCampanha,
  normalizarId
};
