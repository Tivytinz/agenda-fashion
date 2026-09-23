const {
  flagAtiva,
  valorFlagValido,
} = require("../utils/featureFlags");

function texto(env, nome) {
  return String(env[nome] || "").trim();
}

function exigir(env, nomes, contexto) {
  const ausentes = nomes.filter((nome) => !texto(env, nome));

  if (ausentes.length) {
    throw new Error(
      `${contexto}: variáveis ausentes: ${ausentes.join(", ")}.`
    );
  }
}

function validarFlagOpcional(env, nome) {
  if (!valorFlagValido(env[nome])) {
    throw new Error(
      `${nome} precisa ser uma flag booleana válida.`
    );
  }
}

function exigirIntegracao(env, {
  flag,
  contexto,
  variaveis,
}) {
  validarFlagOpcional(env, flag);

  if (flagAtiva(env[flag])) {
    exigir(env, variaveis, contexto);
  }
}

function validarUrl(valor, nome, { exigirHttps = false } = {}) {
  let url;

  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nome} precisa ser uma URL válida.`);
  }

  if (exigirHttps && url.protocol !== "https:") {
    throw new Error(`${nome} precisa usar HTTPS em produção.`);
  }

  return url;
}

function validarInteiroOpcional(
  env,
  nome,
  { minimo = 1, maximo = Number.MAX_SAFE_INTEGER } = {}
) {
  if (!texto(env, nome)) {
    return;
  }

  const valor = Number(env[nome]);

  if (
    !Number.isInteger(valor) ||
    valor < minimo ||
    valor > maximo
  ) {
    throw new Error(
      `${nome} precisa ser um inteiro entre ${minimo} e ${maximo}.`
    );
  }
}

function exigirPadrao(env, nome, padrao, contexto) {
  const valor = texto(env, nome);
  if (!padrao.test(valor)) {
    throw new Error(`${contexto}: ${nome} possui formato inválido.`);
  }
}

function exigirTamanhoMinimo(env, nome, minimo, contexto) {
  if (texto(env, nome).length < minimo) {
    throw new Error(
      `${contexto}: ${nome} precisa ter pelo menos ${minimo} caracteres.`
    );
  }
}

function validarConfiguracaoRuntime(env = process.env) {
  const producao = texto(env, "NODE_ENV") === "production";

  if (!texto(env, "DATABASE_URL") && !texto(env, "DATABASE_PRIVATE_URL")) {
    throw new Error(
      "Banco: configure DATABASE_URL ou DATABASE_PRIVATE_URL."
    );
  }

  exigir(env, ["JWT_SECRET"], "Autenticação");

  if (texto(env, "JWT_SECRET").length < 32) {
    throw new Error(
      "JWT_SECRET precisa ter pelo menos 32 caracteres."
    );
  }

  validarInteiroOpcional(env, "PORT", {
    minimo: 1,
    maximo: 65535,
  });

  for (const nome of [
    "DB_POOL_MAX",
    "DB_CONNECTION_TIMEOUT",
    "DB_IDLE_TIMEOUT",
    "DB_STATEMENT_TIMEOUT",
    "DB_QUERY_TIMEOUT",
    "DB_LOCK_TIMEOUT",
    "DB_IDLE_TRANSACTION_TIMEOUT",
  ]) {
    validarInteiroOpcional(env, nome);
  }

  validarInteiroOpcional(env, "GOOGLE_MEASUREMENT_TIMEOUT_MS", {
    minimo: 500,
    maximo: 5000,
  });
  validarInteiroOpcional(env, "META_CAPI_TIMEOUT_MS", {
    minimo: 500,
    maximo: 5000,
  });
  validarInteiroOpcional(env, "GA4_DATA_API_TIMEOUT_MS", {
    minimo: 1000,
    maximo: 15000,
  });
  validarInteiroOpcional(env, "MARKETING_COST_SYNC_TIMEOUT_MS", {
    minimo: 1000,
    maximo: 30000,
  });
  validarInteiroOpcional(env, "WHATSAPP_WORKER_INTERVAL_MS", {
    minimo: 5000,
    maximo: 300000,
  });
  validarInteiroOpcional(env, "WHATSAPP_WORKER_BATCH_SIZE", {
    minimo: 1,
    maximo: 100,
  });
  validarInteiroOpcional(env, "ML_NO_SHOW_DATA_INTERVAL_MS", {
    minimo: 60000,
    maximo: 86400000,
  });
  validarInteiroOpcional(env, "ML_NO_SHOW_DATA_BATCH_SIZE", {
    minimo: 1,
    maximo: 500,
  });
  validarInteiroOpcional(env, "BILLING_RECONCILIATION_INTERVAL_MS", {
    minimo: 60000,
    maximo: 3600000,
  });
  validarInteiroOpcional(env, "BILLING_RECONCILIATION_BATCH_SIZE", {
    minimo: 1,
    maximo: 500,
  });
  validarInteiroOpcional(env, "BILLING_DELINQUENCY_TERMINAL_DAYS", {
    minimo: 1,
    maximo: 90,
  });
  validarInteiroOpcional(
    env,
    "ACQUISITION_FINANCIAL_RECONCILIATION_INTERVAL_MS",
    {
      minimo: 60000,
      maximo: 3600000,
    }
  );
  validarInteiroOpcional(
    env,
    "ACQUISITION_FINANCIAL_RECONCILIATION_BATCH_SIZE",
    {
      minimo: 1,
      maximo: 500,
    }
  );

  validarInteiroOpcional(env, "BCRYPT_ROUNDS", {
    minimo: 10,
    maximo: 14,
  });
  validarInteiroOpcional(env, "WHATSAPP_REMINDER_HOURS", {
    minimo: 1,
    maximo: 168,
  });
  validarInteiroOpcional(env, "WHATSAPP_BUSINESS_REMINDER_HOUR", {
    minimo: 0,
    maximo: 23,
  });
  validarInteiroOpcional(env, "WHATSAPP_BUSINESS_REMINDER_INTERVAL_DAYS", {
    minimo: 1,
    maximo: 30,
  });
  validarInteiroOpcional(env, "WHATSAPP_BUSINESS_REMINDER_MAX_SENDS", {
    minimo: 1,
    maximo: 10,
  });

  const flagsConhecidas = [
    "BACKGROUND_WORKERS_ENABLED",
    "MARKETING_COST_SYNC_SCHEDULE_ENABLED",
    "ML_NO_SHOW_DATA_ENABLED",
    "WHATSAPP_NOTIFICATIONS_ENABLED",
    "WHATSAPP_PROFESSIONAL_REMINDER_ENABLED",
    "WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED",
    "WHATSAPP_SHARE_REMINDER_ENABLED",
    "WHATSAPP_CONVERSATION_AUTOREPLIES_ENABLED",
  ];

  for (const nome of flagsConhecidas) {
    validarFlagOpcional(env, nome);
  }

  const origensCors = texto(env, "CORS_ORIGINS")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean);

  for (const origem of origensCors) {
    validarUrl(origem, "CORS_ORIGINS", {
      exigirHttps: producao,
    });
  }

  if (producao) {
    exigir(
      env,
      [
        "PUBLIC_APP_URL",
        "ASAAS_API_URL",
        "ASAAS_API_KEY",
        "ASAAS_WEBHOOK_TOKEN",
      ],
      "Produção"
    );
    validarUrl(texto(env, "PUBLIC_APP_URL"), "PUBLIC_APP_URL", {
      exigirHttps: true,
    });
    validarUrl(texto(env, "ASAAS_API_URL"), "ASAAS_API_URL", {
      exigirHttps: true,
    });
  }

  if (flagAtiva(env.WHATSAPP_NOTIFICATIONS_ENABLED)) {
    exigir(
      env,
      [
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_API_VERSION",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        "WHATSAPP_APP_SECRET",
      ],
      "WhatsApp"
    );
  }

  const integracoes = [
    {
      flag: "PASSWORD_RESET_EMAIL_ENABLED",
      contexto: "E-mail de recuperação",
      variaveis: ["RESEND_API_KEY", "PASSWORD_RESET_EMAIL_FROM"],
    },
    {
      flag: "GOOGLE_MEASUREMENT_ENABLED",
      contexto: "Google Measurement",
      variaveis: ["GA4_MEASUREMENT_ID", "GA4_API_SECRET"],
    },
    {
      flag: "GA4_DATA_API_ENABLED",
      contexto: "GA4 Data API",
      variaveis: [
        "GA4_PROPERTY_ID",
        "GA4_SERVICE_ACCOUNT_EMAIL",
        "GA4_SERVICE_ACCOUNT_PRIVATE_KEY",
      ],
    },
    {
      flag: "META_ADS_ENABLED",
      contexto: "Meta Ads",
      variaveis: ["META_PIXEL_ID", "META_CAPI_ACCESS_TOKEN"],
    },
    {
      flag: "GOOGLE_ADS_COSTS_ENABLED",
      contexto: "Custos Google Ads",
      variaveis: [
        "GOOGLE_ADS_CUSTOMER_ID",
        "GOOGLE_ADS_DEVELOPER_TOKEN",
        "GOOGLE_ADS_CLIENT_ID",
        "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_REFRESH_TOKEN",
      ],
    },
    {
      flag: "META_ADS_COSTS_ENABLED",
      contexto: "Custos Meta Ads",
      variaveis: ["META_AD_ACCOUNT_ID", "META_MARKETING_ACCESS_TOKEN"],
    },
    {
      flag: "TIKTOK_ADS_COSTS_ENABLED",
      contexto: "Custos TikTok Ads",
      variaveis: [
        "TIKTOK_ADVERTISER_ID",
        "TIKTOK_APP_ID",
        "TIKTOK_APP_SECRET",
        "TIKTOK_OAUTH_ENCRYPTION_KEY",
        "TIKTOK_OAUTH_REDIRECT_URI",
      ],
    },
    {
      flag: "PINTEREST_ADS_COSTS_ENABLED",
      contexto: "Custos Pinterest Ads",
      variaveis: [
        "PINTEREST_AD_ACCOUNT_ID",
        "PINTEREST_APP_ID",
        "PINTEREST_APP_SECRET",
        "PINTEREST_OAUTH_ENCRYPTION_KEY",
        "PINTEREST_OAUTH_REDIRECT_URI",
      ],
    },
    {
      flag: "COPILOT_AI_ENABLED",
      contexto: "Copilot",
      variaveis: ["OPENAI_API_KEY"],
    },
  ];

  for (const integracao of integracoes) {
    exigirIntegracao(env, integracao);
  }

  if (flagAtiva(env.GOOGLE_MEASUREMENT_ENABLED)) {
    exigirPadrao(
      env,
      "GA4_MEASUREMENT_ID",
      /^G-[A-Z0-9]{6,20}$/i,
      "Google Measurement"
    );
  }

  if (flagAtiva(env.GA4_DATA_API_ENABLED)) {
    exigirPadrao(env, "GA4_PROPERTY_ID", /^\d{4,30}$/, "GA4 Data API");
    exigirPadrao(
      env,
      "GA4_SERVICE_ACCOUNT_EMAIL",
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "GA4 Data API"
    );
    exigirPadrao(
      env,
      "GA4_SERVICE_ACCOUNT_PRIVATE_KEY",
      /BEGIN PRIVATE KEY[\s\S]+END PRIVATE KEY/,
      "GA4 Data API"
    );
  }

  if (flagAtiva(env.META_ADS_ENABLED)) {
    exigirPadrao(env, "META_PIXEL_ID", /^\d{5,30}$/, "Meta Ads");
  }

  if (flagAtiva(env.GOOGLE_ADS_COSTS_ENABLED)) {
    exigirPadrao(
      env,
      "GOOGLE_ADS_CUSTOMER_ID",
      /^[0-9-]{6,24}$/,
      "Custos Google Ads"
    );
  }

  if (flagAtiva(env.META_ADS_COSTS_ENABLED)) {
    exigirPadrao(
      env,
      "META_AD_ACCOUNT_ID",
      /^(?:act_)?\d{5,30}$/i,
      "Custos Meta Ads"
    );
  }

  for (const [flag, prefixo, contexto] of [
    ["TIKTOK_ADS_COSTS_ENABLED", "TIKTOK", "Custos TikTok Ads"],
    ["PINTEREST_ADS_COSTS_ENABLED", "PINTEREST", "Custos Pinterest Ads"],
  ]) {
    if (!flagAtiva(env[flag])) continue;
    exigirTamanhoMinimo(
      env,
      `${prefixo}_OAUTH_ENCRYPTION_KEY`,
      32,
      contexto
    );
    validarUrl(
      texto(env, `${prefixo}_OAUTH_REDIRECT_URI`),
      `${prefixo}_OAUTH_REDIRECT_URI`,
      { exigirHttps: producao }
    );
  }

  if (flagAtiva(env.COPILOT_AI_ENABLED) && texto(env, "OPENAI_API_URL")) {
    validarUrl(texto(env, "OPENAI_API_URL"), "OPENAI_API_URL", {
      exigirHttps: producao,
    });
  }

  return {
    ambiente: texto(env, "NODE_ENV") || "development",
    producao,
    whatsappAtivo: flagAtiva(
      env.WHATSAPP_NOTIFICATIONS_ENABLED
    ),
    sincronizacaoMarketingAtiva: flagAtiva(
      env.MARKETING_COST_SYNC_SCHEDULE_ENABLED
    ),
    coletaMlNoShowAtiva: flagAtiva(
      env.ML_NO_SHOW_DATA_ENABLED
    ),
    workersAtivos:
      texto(env, "BACKGROUND_WORKERS_ENABLED") === ""
        ? true
        : flagAtiva(env.BACKGROUND_WORKERS_ENABLED),
  };
}

module.exports = {
  validarConfiguracaoRuntime,
};
