const AppError = require("../errors/AppError");
const oauthService = require("./pinterestMarketingOAuthService");

const PROVIDER_ID = "pinterest_ads";
const PROVIDER_NAME = "Pinterest Ads";
const BASE_URL = "https://api.pinterest.com";
const DEFAULT_VERSION = "v5";
const DEFAULT_TIMEOUT_MS = 10000;
const PAGE_SIZE = 100;
const ANALYTICS_BATCH_SIZE = 100;

function envFlag(name) {
  return ["1", "true", "yes", "on"].includes(
    String(process.env[name] || "").trim().toLowerCase()
  );
}

function normalizarId(value) {
  return String(value || "").replace(/\D/g, "");
}

function config() {
  const adAccountId = normalizarId(
    process.env.PINTEREST_AD_ACCOUNT_ID
  );
  const apiVersion =
    String(
      process.env.PINTEREST_API_VERSION || DEFAULT_VERSION
    ).trim() || DEFAULT_VERSION;
  const timeout = Number(
    process.env.MARKETING_COST_SYNC_TIMEOUT_MS ||
      DEFAULT_TIMEOUT_MS
  );

  return {
    enabled: envFlag("PINTEREST_ADS_COSTS_ENABLED"),
    adAccountId,
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
        atual.adAccountId &&
        autorizacao.disponivel &&
        autorizacao.autorizado
    ),
    contaExternaId: atual.adAccountId || null,
    requerAutorizacao: true,
    autorizacao
  };
}

async function exigirConfigurado() {
  const atual = config();
  if (!atual.enabled) {
    throw new AppError(
      "Importação de custos do Pinterest Ads está desativada.",
      409
    );
  }
  if (!atual.adAccountId) {
    throw new AppError(
      "PINTEREST_AD_ACCOUNT_ID não está configurado.",
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
  const mensagem = String(
    payload?.message || payload?.error?.message || ""
  )
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 180);
  return mensagem || fallback;
}

async function pinterestGet(path, params = {}) {
  const atual = await exigirConfigurado();
  const url = new URL(
    `${BASE_URL}/${atual.apiVersion}/${String(path).replace(/^\/+|\/+$/g, "")}`
  );

  for (const [key, value] of Object.entries(params)) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }
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
        Authorization: `Bearer ${atual.accessToken}`
      },
      signal: controller.signal
    });
    const payload = await jsonSeguro(response);

    if (!response.ok) {
      throw new AppError(
        `Pinterest Ads indisponível: ${mensagemApi(
          payload,
          `HTTP ${response.status}`
        )}.`,
        502
      );
    }

    return payload;
  } catch (erro) {
    if (erro?.name === "AbortError") {
      throw new AppError(
        "Pinterest Ads demorou demais para responder.",
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
  const conta = await pinterestGet(
    `ad_accounts/${atual.adAccountId}`
  );
  const returnedId = normalizarId(conta?.id);

  if (!returnedId || returnedId !== atual.adAccountId) {
    throw new AppError(
      "Pinterest Ads respondeu sem a conta configurada.",
      502
    );
  }

  return conta;
}

function mapearCampanha(item, adAccountId) {
  const id = normalizarId(item?.id);
  if (!id) return null;

  return {
    contaExternaId: adAccountId,
    campanhaExternaId: id,
    campanhaExternaNome: String(item?.name || "").trim(),
    status: String(
      item?.status || item?.summary_status || "UNKNOWN"
    ),
    tipo: String(item?.objective_type || "UNKNOWN")
  };
}

async function listarCampanhas() {
  const atual = config();
  const rows = [];
  let bookmark = "";
  let paginas = 0;

  do {
    paginas += 1;
    if (paginas > 100) {
      throw new AppError(
        "Pinterest Ads devolveu mais páginas de campanhas do que o limite seguro.",
        502
      );
    }

    const payload = await pinterestGet(
      `ad_accounts/${atual.adAccountId}/campaigns`,
      {
        page_size: PAGE_SIZE,
        ...(bookmark ? { bookmark } : {})
      }
    );

    const items = Array.isArray(payload?.items)
      ? payload.items
      : [];
    rows.push(...items);
    bookmark = String(payload?.bookmark || "").trim();
  } while (bookmark);

  return rows
    .map((item) =>
      mapearCampanha(item, atual.adAccountId)
    )
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
    throw new AppError(
      "Informe uma campanha válida do Pinterest Ads.",
      400
    );
  }

  const atual = config();
  const payload = await pinterestGet(
    `ad_accounts/${atual.adAccountId}/campaigns/${id}`
  );
  const campanha = mapearCampanha(
    payload,
    atual.adAccountId
  );

  if (!campanha || campanha.campanhaExternaId !== id) {
    throw new AppError(
      "Campanha não encontrada na conta configurada do Pinterest Ads.",
      404
    );
  }
  return campanha;
}

function emLotes(items, tamanho) {
  const lotes = [];
  for (let i = 0; i < items.length; i += tamanho) {
    lotes.push(items.slice(i, i + tamanho));
  }
  return lotes;
}

async function listarCustos({ dataInicio, dataFim }) {
  const atual = config();
  const campanhas = await listarCampanhas();
  const ids = campanhas.map(
    (item) => item.campanhaExternaId
  );
  if (ids.length === 0) return [];

  const nomes = new Map(
    campanhas.map((item) => [
      item.campanhaExternaId,
      item.campanhaExternaNome
    ])
  );
  const rows = [];

  for (const lote of emLotes(ids, ANALYTICS_BATCH_SIZE)) {
    const payload = await pinterestGet(
      `ad_accounts/${atual.adAccountId}/campaigns/analytics`,
      {
        start_date: dataInicio,
        end_date: dataFim,
        campaign_ids: lote.join(","),
        columns: "SPEND_IN_MICRO_DOLLAR",
        granularity: "DAY",
        click_window_days: 30,
        engagement_window_days: 30,
        view_window_days: 1,
        conversion_report_time: "TIME_OF_AD_ACTION"
      }
    );

    if (!Array.isArray(payload)) {
      throw new AppError(
        "Pinterest Ads devolveu analytics em formato inesperado.",
        502
      );
    }
    rows.push(...payload);
  }

  return rows
    .map((item) => {
      const campaignId = normalizarId(
        item?.CAMPAIGN_ID ?? item?.campaign_id
      );
      const date = String(
        item?.DATE ?? item?.date ?? ""
      ).slice(0, 10);
      const micros = Number(
        item?.SPEND_IN_MICRO_DOLLAR ??
          item?.spend_in_micro_dollar ??
          0
      );

      if (
        !campaignId ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(micros) ||
        micros < 0
      ) {
        return null;
      }

      return {
        contaExternaId: atual.adAccountId,
        campanhaExternaId: campaignId,
        campanhaExternaNome:
          String(
            item?.CAMPAIGN_NAME ??
              item?.campaign_name ??
              nomes.get(campaignId) ??
              ""
          ).trim(),
        dataGasto: date,
        valorCentavos: Math.round(micros / 10000)
      };
    })
    .filter(
      (item) => item && item.valorCentavos > 0
    );
}

async function testarConexao() {
  const atual = config();
  const conta = await buscarConta();
  const returnedId = normalizarId(conta?.id);

  return {
    provedor: PROVIDER_ID,
    conectado: true,
    contaExternaId: returnedId,
    nomeConta:
      String(conta?.name || "").trim() || null,
    moeda:
      String(conta?.currency || "").trim() || null,
    fusoHorario:
      String(conta?.timezone || "").trim() || null,
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
