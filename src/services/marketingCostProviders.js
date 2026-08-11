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

async function listarGoogle({ dataInicio, dataFim }) {
  const config = googleConfig();
  if (!config.configured) {
    throw new AppError("Importação de custos do Google Ads ainda não está configurada.", 409);
  }
  const accessToken = await googleAccessToken(config);
  const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${dataInicio}' AND '${dataFim}' AND campaign.status != 'REMOVED'`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": config.developerToken
  };
  if (config.loginCustomerId) headers["login-customer-id"] = config.loginCustomerId;
  const payload = await fetchJson(
    `https://googleads.googleapis.com/${config.version}/customers/${config.customerId}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) }
  );
  const chunks = Array.isArray(payload) ? payload : [];
  const rows = chunks.flatMap((chunk) => Array.isArray(chunk.results) ? chunk.results : []);
  return rows.map((row) => ({
    contaExternaId: config.customerId,
    campanhaExternaId: String(row?.campaign?.id || ""),
    campanhaExternaNome: String(row?.campaign?.name || ""),
    dataGasto: String(row?.segments?.date || ""),
    valorCentavos: Math.max(0, Math.round(Number(row?.metrics?.costMicros || 0) / 10000))
  })).filter((item) => item.campanhaExternaId && item.dataGasto && item.valorCentavos > 0);
}

function metaConfig() {
  const account = texto(process.env.META_AD_ACCOUNT_ID).replace(/^act_/, "");
  const config = {
    enabled: flagAtiva(process.env.META_ADS_COSTS_ENABLED),
    accountId: account,
    accessToken: texto(process.env.META_MARKETING_ACCESS_TOKEN),
    version: texto(process.env.META_GRAPH_API_VERSION) || "v25.0"
  };
  config.configured = Boolean(config.enabled && config.accountId && config.accessToken);
  return config;
}

async function listarMeta({ dataInicio, dataFim }) {
  const config = metaConfig();
  if (!config.configured) {
    throw new AppError("Importação de custos da Meta ainda não está configurada.", 409);
  }
  const base = new URL(`https://graph.facebook.com/${config.version}/act_${config.accountId}/insights`);
  base.searchParams.set("level", "campaign");
  base.searchParams.set("fields", "campaign_id,campaign_name,spend,date_start,date_stop");
  base.searchParams.set("time_increment", "1");
  base.searchParams.set("time_range", JSON.stringify({ since: dataInicio, until: dataFim }));
  base.searchParams.set("limit", "500");
  base.searchParams.set("access_token", config.accessToken);

  const rows = [];
  let next = base.toString();
  let paginas = 0;
  while (next && paginas < 20) {
    const payload = await fetchJson(next);
    rows.push(...(Array.isArray(payload.data) ? payload.data : []));
    next = typeof payload?.paging?.next === "string" ? payload.paging.next : "";
    paginas += 1;
  }
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

module.exports = { PROVIDERS, status, listarCustos, googleConfig, metaConfig };
