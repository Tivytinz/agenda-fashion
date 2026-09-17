const { flagAtiva } = require("./marketingCostSync");

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

  return {
    ambiente: texto(env, "NODE_ENV") || "development",
    producao,
    whatsappAtivo: flagAtiva(
      env.WHATSAPP_NOTIFICATIONS_ENABLED
    ),
    sincronizacaoMarketingAtiva: flagAtiva(
      env.MARKETING_COST_SYNC_SCHEDULE_ENABLED
    ),
  };
}

module.exports = {
  validarConfiguracaoRuntime,
};
