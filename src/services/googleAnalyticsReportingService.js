const { GoogleAuth } = require("google-auth-library");

const AppError = require("../errors/AppError");
const registrador = require("../utils/registrador");

const DATA_API_SCOPE =
  "https://www.googleapis.com/auth/analytics.readonly";
const DATA_API_BASE =
  "https://analyticsdata.googleapis.com/v1beta";
const REPORT_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_ALL_START_DATE = "2020-10-14";
const VALID_PERIODS = new Set([
  "today",
  "7",
  "30",
  "month",
  "all"
]);

function texto(valor) {
  return String(valor ?? "").trim();
}

function flagAtiva(valor) {
  return ["1", "true", "yes", "sim", "on"].includes(
    texto(valor).toLowerCase()
  );
}

function dataIsoValida(valor) {
  const value = texto(valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}

function hojeNoFusoRelatorio(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);
  const valor = (tipo) =>
    partes.find((item) => item.type === tipo)?.value;

  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function deslocarDias(dataIso, dias) {
  const date = new Date(`${dataIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}

function inicioMes(dataIso) {
  return `${dataIso.slice(0, 7)}-01`;
}

function normalizarPeriodo(valor, agora = new Date(), env = process.env) {
  const periodo = texto(valor || "30").toLowerCase();
  if (!VALID_PERIODS.has(periodo)) {
    throw new AppError("Período inválido para o relatório do GA4.", 400);
  }

  const fim = hojeNoFusoRelatorio(agora);
  let inicio;

  if (periodo === "today") {
    inicio = fim;
  } else if (periodo === "7") {
    inicio = deslocarDias(fim, -6);
  } else if (periodo === "30") {
    inicio = deslocarDias(fim, -29);
  } else if (periodo === "month") {
    inicio = inicioMes(fim);
  } else {
    const configurado = dataIsoValida(
      env.GA4_REPORTING_START_DATE
    );
    inicio = configurado && configurado <= fim
      ? configurado
      : DEFAULT_ALL_START_DATE;
  }

  return {
    periodo,
    dataInicio: inicio,
    dataFim: fim
  };
}

function obterTimeoutMs(env = process.env) {
  const value = Number(env.GA4_DATA_API_TIMEOUT_MS);
  return Number.isInteger(value) && value >= 1000 && value <= 15000
    ? value
    : DEFAULT_TIMEOUT_MS;
}

function normalizarPrivateKey(valor) {
  return texto(valor).replace(/\\n/g, "\n");
}

function configuracao(env = process.env) {
  const habilitado = flagAtiva(env.GA4_DATA_API_ENABLED);
  const propertyId = texto(env.GA4_PROPERTY_ID);
  const clientEmail = texto(env.GA4_SERVICE_ACCOUNT_EMAIL);
  const privateKey = normalizarPrivateKey(
    env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  const propertyValid = /^\d{4,30}$/.test(propertyId);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail);
  const keyValid = privateKey.includes("BEGIN PRIVATE KEY") &&
    privateKey.includes("END PRIVATE KEY");

  return {
    habilitado,
    configurado:
      habilitado && propertyValid && emailValid && keyValid,
    propertyId: propertyValid ? propertyId : null,
    clientEmail: emailValid ? clientEmail : null,
    privateKey: keyValid ? privateKey : null,
    timeoutMs: obterTimeoutMs(env)
  };
}

function metric(name) {
  return { name };
}

function dimension(name) {
  return { name };
}

function orderBySessions() {
  return [{ metric: { metricName: "sessions" }, desc: true }];
}

function adminLandingPageFilter() {
  return {
    notExpression: {
      filter: {
        fieldName: "landingPage",
        stringFilter: {
          matchType: "BEGINS_WITH",
          value: "/admin",
          caseSensitive: false
        }
      }
    }
  };
}

function montarRequests(periodo) {
  const dateRanges = [{
    startDate: periodo.dataInicio,
    endDate: periodo.dataFim
  }];

  return [
    {
      dateRanges,
      dimensionFilter: adminLandingPageFilter(),
      metrics: [
        metric("sessions"),
        metric("totalUsers"),
        metric("newUsers"),
        metric("engagedSessions"),
        metric("engagementRate"),
        metric("screenPageViews")
      ],
      limit: "1"
    },
    {
      dateRanges,
      dimensionFilter: adminLandingPageFilter(),
      dimensions: [
        dimension("sessionDefaultChannelGroup"),
        dimension("sessionSource"),
        dimension("sessionMedium")
      ],
      metrics: [
        metric("sessions"),
        metric("totalUsers"),
        metric("newUsers"),
        metric("engagedSessions")
      ],
      orderBys: orderBySessions(),
      limit: "12"
    },
    {
      dateRanges,
      dimensionFilter: adminLandingPageFilter(),
      dimensions: [
        dimension("sessionCampaignId"),
        dimension("sessionCampaignName"),
        dimension("sessionSource"),
        dimension("sessionMedium")
      ],
      metrics: [
        metric("sessions"),
        metric("totalUsers"),
        metric("newUsers"),
        metric("engagedSessions")
      ],
      orderBys: orderBySessions(),
      limit: "12"
    },
    {
      dateRanges,
      dimensionFilter: adminLandingPageFilter(),
      dimensions: [dimension("landingPage")],
      metrics: [
        metric("sessions"),
        metric("totalUsers"),
        metric("engagedSessions")
      ],
      orderBys: orderBySessions(),
      limit: "10"
    },
    {
      dateRanges,
      dimensionFilter: adminLandingPageFilter(),
      dimensions: [dimension("deviceCategory")],
      metrics: [metric("sessions"), metric("totalUsers")],
      orderBys: orderBySessions(),
      limit: "6"
    }
  ];
}

function montarLocationRequest(periodo) {
  return {
    dateRanges: [{
      startDate: periodo.dataInicio,
      endDate: periodo.dataFim
    }],
    dimensionFilter: adminLandingPageFilter(),
    dimensions: [
      dimension("country"),
      dimension("region"),
      dimension("city")
    ],
    metrics: [metric("sessions"), metric("totalUsers")],
    orderBys: orderBySessions(),
    limit: "10"
  };
}

function valorNumero(valor) {
  const number = Number(valor);
  return Number.isFinite(number) ? number : 0;
}

function mapearLinhas(report = {}) {
  const dimensions = (report.dimensionHeaders || []).map(
    (item) => item.name
  );
  const metrics = (report.metricHeaders || []).map(
    (item) => item.name
  );

  return (report.rows || []).map((row) => {
    const item = {};
    dimensions.forEach((name, index) => {
      item[name] = row.dimensionValues?.[index]?.value || "";
    });
    metrics.forEach((name, index) => {
      item[name] = valorNumero(
        row.metricValues?.[index]?.value
      );
    });
    return item;
  });
}

function percentualFracao(valor) {
  return Number((valorNumero(valor) * 100).toFixed(2));
}

function mapearResumo(report = {}) {
  const row = mapearLinhas(report)[0] || {};
  return {
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers),
    novosUsuarios: valorNumero(row.newUsers),
    sessoesEngajadas: valorNumero(row.engagedSessions),
    taxaEngajamentoPercentual:
      percentualFracao(row.engagementRate),
    visualizacoes: valorNumero(row.screenPageViews)
  };
}

function mapearCanais(report = {}) {
  return mapearLinhas(report).map((row) => ({
    canal: row.sessionDefaultChannelGroup || "Não identificado",
    origem: row.sessionSource || "(not set)",
    midia: row.sessionMedium || "(not set)",
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers),
    novosUsuarios: valorNumero(row.newUsers),
    sessoesEngajadas: valorNumero(row.engagedSessions)
  }));
}

function mapearCampanhas(report = {}) {
  return mapearLinhas(report).map((row) => ({
    id: row.sessionCampaignId || null,
    nome: row.sessionCampaignName || "(not set)",
    origem: row.sessionSource || "(not set)",
    midia: row.sessionMedium || "(not set)",
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers),
    novosUsuarios: valorNumero(row.newUsers),
    sessoesEngajadas: valorNumero(row.engagedSessions)
  }));
}

function mapearLandingPages(report = {}) {
  return mapearLinhas(report).map((row) => ({
    pagina: row.landingPage || "/",
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers),
    sessoesEngajadas: valorNumero(row.engagedSessions)
  }));
}

function mapearDispositivos(report = {}) {
  return mapearLinhas(report).map((row) => ({
    categoria: row.deviceCategory || "unknown",
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers)
  }));
}

function mapearLocalidades(report = {}) {
  return mapearLinhas(report).map((row) => ({
    pais: row.country || "Não identificado",
    regiao: row.region || "Não identificada",
    cidade: row.city || "Não identificada",
    sessoes: valorNumero(row.sessions),
    usuarios: valorNumero(row.totalUsers)
  }));
}

function relatorioAmostrado(report = {}) {
  return Array.isArray(report?.metadata?.samplingMetadatas) &&
    report.metadata.samplingMetadatas.length > 0;
}

function relatorioLimitado(report = {}) {
  return report?.metadata?.dataLossFromOtherRow === true ||
    report?.metadata?.subjectToThresholding === true;
}

function mapearResposta(payload, periodo) {
  const reports = Array.isArray(payload?.reports)
    ? payload.reports
    : [];

  return {
    habilitado: true,
    configurado: true,
    fonte: "Google Analytics 4 · Data API",
    periodo,
    resumo: mapearResumo(reports[0]),
    canais: mapearCanais(reports[1]),
    campanhas: mapearCampanhas(reports[2]),
    landingPages: mapearLandingPages(reports[3]),
    dispositivos: mapearDispositivos(reports[4]),
    localidades: mapearLocalidades(payload?.locationReport),
    amostrado:
      reports.some(relatorioAmostrado) ||
      relatorioAmostrado(payload?.locationReport),
    dadosLimitados:
      reports.some(relatorioLimitado) ||
      relatorioLimitado(payload?.locationReport),
    metadados: {
      moeda: reports[0]?.metadata?.currencyCode || null,
      fusoHorario: reports[0]?.metadata?.timeZone || null
    }
  };
}

async function obterToken(config) {
  const auth = new GoogleAuth({
    credentials: {
      client_email: config.clientEmail,
      private_key: config.privateKey
    },
    scopes: [DATA_API_SCOPE]
  });
  const client = await auth.getClient();
  const result = await client.getAccessToken();
  const token = typeof result === "string"
    ? result
    : result?.token;

  if (!token) {
    throw new Error("token_ausente");
  }

  return token;
}

async function consultarDataApi({ config, periodo }) {
  const token = await obterToken(config);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    config.timeoutMs
  );
  const propertyBase =
    `${DATA_API_BASE}/properties/${encodeURIComponent(config.propertyId)}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  try {
    const [batchResponse, locationResponse] = await Promise.all([
      fetch(`${propertyBase}:batchRunReports`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          requests: montarRequests(periodo)
        }),
        signal: controller.signal
      }),
      fetch(`${propertyBase}:runReport`, {
        method: "POST",
        headers,
        body: JSON.stringify(
          montarLocationRequest(periodo)
        ),
        signal: controller.signal
      })
    ]);

    if (!batchResponse.ok || !locationResponse.ok) {
      const error = new Error(
        "ga4_data_api_rejeitou_relatorio"
      );
      error.status =
        !batchResponse.ok
          ? batchResponse.status
          : locationResponse.status;
      throw error;
    }

    const [batchPayload, locationReport] = await Promise.all([
      batchResponse.json(),
      locationResponse.json()
    ]);

    return {
      ...batchPayload,
      locationReport
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function buscarPainel({ periodo, agora, env = process.env } = {}) {
  const config = configuracao(env);
  const range = normalizarPeriodo(periodo, agora, env);

  if (!config.habilitado) {
    return {
      habilitado: false,
      configurado: false,
      motivo: "desabilitado",
      periodo: range
    };
  }

  if (!config.configurado) {
    return {
      habilitado: true,
      configurado: false,
      motivo: "configuracao_incompleta",
      periodo: range
    };
  }

  try {
    const payload = await consultarDataApi({
      config,
      periodo: range
    });
    return mapearResposta(payload, range);
  } catch (erro) {
    registrador.aviso(
      "[GA4 Data API] Falha ao carregar relatório administrativo.",
      {
        status: erro?.status || null,
        erro:
          erro?.name === "AbortError"
            ? "timeout"
            : "consulta_falhou"
      }
    );
    throw new AppError(
      "Não foi possível consultar o Google Analytics agora.",
      502
    );
  }
}

module.exports = {
  buscarPainel,
  configuracao,
  normalizarPeriodo,
  normalizarPrivateKey,
  adminLandingPageFilter,
  montarRequests,
  montarLocationRequest,
  mapearResposta,
  hojeNoFusoRelatorio
};
