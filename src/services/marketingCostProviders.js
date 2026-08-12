const AppError = require("../errors/AppError");

const PROVIDERS = Object.freeze({
  google_ads: "Google Ads",
  meta_ads: "Meta Ads"
});

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

function texto(valor) {
  return String(valor || "").trim();
}

function timeoutMs() {
  const valor = Number(process.env.MARKETING_COST_SYNC_TIMEOUT_MS || 10000);
  return Number.isFinite(valor) && valor >= 1000 && valor <= 30000
    ? Math.trunc(valor)
    : 10000;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detalhe = payload?.error?.message || payload?.error?.status || `HTTP ${response.status}`;
      throw new AppError(`Falha ao consultar plataforma de anúncios: ${detalhe}`, 502);
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

function googleConfig() {
  const config = {
    enabled: flagAtiva(process.env.GOOGLE_ADS_COSTS_ENABLED),
    customerId: texto(process.env.GOOGLE_ADS_CUSTOMER_ID).replace(/\D/g, ""),
    developerToken: texto(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
    clientId: texto(process.env.GOOGLE_ADS_CLIENT_ID),
    clientSecret: texto(process.env.GOOGLE_ADS_CLIENT_SECRET),
    refreshToken: texto(process.env.GOOGLE_ADS_REFRESH_TOKEN),
    loginCustomerId: texto(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, ""),
    version: texto(process.env.GOOGLE_ADS_API_VERSION) || "v25"
  };
  config.configured = Boolean(
    config.enabled && config.customerId && config.developerToken &&
    config.clientId && config.clientSecret && config.refreshToken
  );
  return config;
}

function exigirGoogleConfigurado(config) {
  if (!config.configured) {
    throw new AppError("Integração com Google Ads ainda não está configurada.", 409);
  }
}

async function googleAccessToken(config) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token"
  });
  const payload = await fetchJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!payload.access_token) {
    throw new AppError("Google Ads não devolveu um token de acesso.", 502);
  }
  return payload.access_token;
}

function googleHeaders(config, accessToken) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;
  return headers;
}

async function googleQuery(config, query) {
  exigirGoogleConfigurado(config);
  const accessToken = await googleAccessToken(config);
  const payload = await fetchJson(
    `https://googleads.googleapis.com/${config.version}/customers/${config.customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: googleHeaders(config, accessToken),
      body: JSON.stringify({ query })
    }
  );
  const chunks = Array.isArray(payload) ? payload : [];
  return chunks.flatMap((chunk) => Array.isArray(chunk.results) ? chunk.results : []);
}

function mapearGoogleCampanha(row, customerId) {
  const id = String(row?.campaign?.id || "");
  if (!id) return null;
  return {
    contaExternaId: customerId,
    campanhaExternaId: id,
    campanhaExternaNome: String(row?.campaign?.name || ""),
    status: String(row?.campaign?.status || "UNKNOWN"),
    tipo: String(row?.campaign?.advertisingChannelType || "UNKNOWN")
  };
}

async function testarGoogleConexao() {
  const config = googleConfig();
  const query = [
    "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone",
    "FROM customer",
    "LIMIT 1"
  ].join(" ");
  const rows = await googleQuery(config, query);
  const customer = rows[0]?.customer;
  const customerId = String(customer?.id || "").replace(/\D/g, "");

  if (!customerId) {
    throw new AppError("Google Ads respondeu sem identificar a conta configurada.", 502);
  }

  if (customerId !== config.customerId) {
    throw new AppError("A conta retornada pelo Google Ads não corresponde ao Customer ID configurado.", 502);
  }

  return {
    provedor: "google_ads",
    conectado: true,
    contaExternaId: customerId,
    nomeConta: String(customer?.descriptiveName || "").trim() || null,
    moeda: String(customer?.currencyCode || "").trim() || null,
    fusoHorario: String(customer?.timeZone || "").trim() || null,
    apiVersion: config.version
  };
}

async function listarGoogleCampanhas() {
  const config = googleConfig();
  const query = [
    "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type",
    "FROM campaign",
    "WHERE campaign.status != 'REMOVED'",
    "ORDER BY campaign.name"
  ].join(" ");
  const rows = await googleQuery(config, query);
  return rows
    .map((row) => mapearGoogleCampanha(row, config.customerId))
    .filter(Boolean);
}

async function buscarGoogleCampanha(campanhaExternaId) {
  const id = String(campanhaExternaId || "").replace(/\D/g, "");
  if (!id) {
    throw new AppError("Informe uma campanha válida do Google Ads.", 400);
  }
  const config = googleConfig();
  const query = [
    "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type",
    "FROM campaign",
    `WHERE campaign.id = ${id}`,
    "AND campaign.status != 'REMOVED'",
    "LIMIT 1"
  ].join(" ");
  const rows = await googleQuery(config, query);
  const campanha = mapearGoogleCampanha(rows[0], config.customerId);
  if (!campanha) {
    throw new AppError("Campanha não encontrada na conta configurada do Google Ads.", 404);
  }
  return campanha;
}

async function listarGoogle({ dataInicio, dataFim }) {
  const config = googleConfig();
  if (!config.configured) {
    throw new AppError("Importação de custos do Google Ads ainda não está configurada.", 409);
  }
  const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${dataInicio}' AND '${dataFim}' AND campaign.status != 'REMOVED'`;
  const rows = await googleQuery(config, query);
  return rows.map((row) => ({
    contaExternaId: config.customerId,
    campanhaExternaId: String(row?.campaign?.id || ""),
    campanhaExternaNome: String(row?.campaign?.name || ""),
    dataGasto: String(row?.segments?.date || ""),
    valorCentavos: Math.max(0, Math.round(Number(row?.metrics?.costMicros || 0) / 10000))
  })).filter((item) => item.campanhaExternaId && item.dataGasto && item.valorCentavos > 0);
}

function metaConfig() {
  const account = texto(process.env.META_AD_ACCOUNT_ID).replace(/^act_/i, "").replace(/\D/g, "");
  const config = {
    enabled: flagAtiva(process.env.META_ADS_COSTS_ENABLED),
    accountId: account,
    accessToken: texto(process.env.META_MARKETING_ACCESS_TOKEN),
    version: texto(process.env.META_GRAPH_API_VERSION) || "v25.0"
  };
  config.configured = Boolean(config.enabled && config.accountId && config.accessToken);
  return config;
}

function exigirMetaConfigurado(config) {
  if (!config.configured) {
    throw new AppError("Integração com Meta Ads ainda não está configurada.", 409);
  }
}

function metaUrl(config, path, params = {}) {
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = new URL(`https://graph.facebook.com/${config.version}/${cleanPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function metaGet(config, path, params = {}) {
  exigirMetaConfigurado(config);
  return fetchJson(metaUrl(config, path, params).toString(), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`
    }
  });
}

async function metaListarPaginas(config, path, params = {}) {
  exigirMetaConfigurado(config);
  const rows = [];
  let after = "";
  let paginas = 0;

  do {
    const payload = await metaGet(config, path, {
      ...params,
      limit: params.limit || 500,
      after: after || undefined
    });
    rows.push(...(Array.isArray(payload?.data) ? payload.data : []));
    const nextAfter = String(payload?.paging?.cursors?.after || "");
    after = payload?.paging?.next && nextAfter ? nextAfter : "";
    paginas += 1;
  } while (after && paginas < 20);

  return rows;
}

function normalizarMetaAccountId(value) {
  return String(value || "").replace(/^act_/i, "").replace(/\D/g, "");
}

function mapearMetaCampanha(row, accountId) {
  const id = String(row?.id || "").replace(/\D/g, "");
  if (!id) return null;
  return {
    contaExternaId: normalizarMetaAccountId(row?.account_id) || accountId,
    campanhaExternaId: id,
    campanhaExternaNome: String(row?.name || ""),
    status: String(row?.effective_status || row?.status || "UNKNOWN"),
    tipo: String(row?.objective || "UNKNOWN")
  };
}

async function testarMetaConexao() {
  const config = metaConfig();
  const account = await metaGet(config, `act_${config.accountId}`, {
    fields: "id,name,currency,timezone_name,account_status"
  });
  const accountId = normalizarMetaAccountId(account?.id);

  if (!accountId) {
    throw new AppError("Meta Ads respondeu sem identificar a conta configurada.", 502);
  }
  if (accountId !== config.accountId) {
    throw new AppError("A conta retornada pelo Meta Ads não corresponde ao Ad Account ID configurado.", 502);
  }

  return {
    provedor: "meta_ads",
    conectado: true,
    contaExternaId: accountId,
    nomeConta: String(account?.name || "").trim() || null,
    moeda: String(account?.currency || "").trim() || null,
    fusoHorario: String(account?.timezone_name || "").trim() || null,
    apiVersion: config.version
  };
}

async function listarMetaCampanhas() {
  const config = metaConfig();
  const rows = await metaListarPaginas(config, `act_${config.accountId}/campaigns`, {
    fields: "id,name,account_id,status,effective_status,objective"
  });
  return rows
    .map((row) => mapearMetaCampanha(row, config.accountId))
    .filter((item) => item && item.status !== "DELETED")
    .sort((a, b) => a.campanhaExternaNome.localeCompare(b.campanhaExternaNome, "pt-BR"));
}

async function buscarMetaCampanha(campanhaExternaId) {
  const id = String(campanhaExternaId || "").replace(/\D/g, "");
  if (!id) {
    throw new AppError("Informe uma campanha válida do Meta Ads.", 400);
  }
  const config = metaConfig();
  const row = await metaGet(config, id, {
    fields: "id,name,account_id,status,effective_status,objective"
  });
  const campanha = mapearMetaCampanha(row, config.accountId);
  if (
    !campanha ||
    campanha.contaExternaId !== config.accountId ||
    campanha.status === "DELETED"
  ) {
    throw new AppError("Campanha não encontrada na conta configurada do Meta Ads.", 404);
  }
  return campanha;
}

async function listarMeta({ dataInicio, dataFim }) {
  const config = metaConfig();
  if (!config.configured) {
    throw new AppError("Importação de custos da Meta ainda não está configurada.", 409);
  }
  const rows = await metaListarPaginas(config, `act_${config.accountId}/insights`, {
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,date_start,date_stop",
    time_increment: "1",
    time_range: JSON.stringify({ since: dataInicio, until: dataFim })
  });
  return rows.map((row) => ({
    contaExternaId: config.accountId,
    campanhaExternaId: String(row?.campaign_id || ""),
    campanhaExternaNome: String(row?.campaign_name || ""),
    dataGasto: String(row?.date_start || ""),
    valorCentavos: Math.max(0, Math.round(Number(row?.spend || 0) * 100))
  })).filter((item) => item.campanhaExternaId && item.dataGasto && item.valorCentavos > 0);
}

function status() {
  const google = googleConfig();
  const meta = metaConfig();
  return [
    { provedor: "google_ads", nome: PROVIDERS.google_ads, habilitado: google.enabled, configurado: google.configured, contaExternaId: google.customerId || null },
    { provedor: "meta_ads", nome: PROVIDERS.meta_ads, habilitado: meta.enabled, configurado: meta.configured, contaExternaId: meta.accountId || null }
  ];
}

async function listarCustos(provedor, periodo) {
  if (provedor === "google_ads") return listarGoogle(periodo);
  if (provedor === "meta_ads") return listarMeta(periodo);
  throw new AppError("Provedor de custos inválido.", 400);
}

async function listarCampanhas(provedor) {
  if (provedor === "google_ads") return listarGoogleCampanhas();
  if (provedor === "meta_ads") return listarMetaCampanhas();
  throw new AppError("Listagem automática de campanhas ainda não está disponível para este provedor.", 409);
}

async function buscarCampanha(provedor, campanhaExternaId) {
  if (provedor === "google_ads") return buscarGoogleCampanha(campanhaExternaId);
  if (provedor === "meta_ads") return buscarMetaCampanha(campanhaExternaId);
  throw new AppError("Validação automática de campanha ainda não está disponível para este provedor.", 409);
}

async function testarConexao(provedor) {
  if (provedor === "google_ads") return testarGoogleConexao();
  if (provedor === "meta_ads") return testarMetaConexao();
  throw new AppError("Teste automático de conexão ainda não está disponível para este provedor.", 409);
}

module.exports = {
  PROVIDERS,
  status,
  listarCustos,
  listarCampanhas,
  buscarCampanha,
  testarConexao,
  googleConfig,
  metaConfig
};
