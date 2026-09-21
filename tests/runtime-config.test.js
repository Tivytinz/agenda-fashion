const {
  validarConfiguracaoRuntime,
} = require("../src/config/runtime");

function ambienteBase() {
  return {
    NODE_ENV: "test",
    DATABASE_URL:
      "postgresql://postgres:postgres@127.0.0.1:5432/agenda_fashion_test",
    JWT_SECRET:
      "segredo-de-teste-com-mais-de-32-caracteres",
  };
}

describe("configuração central do runtime", () => {
  test("aceita a configuração mínima fora de produção", () => {
    expect(
      validarConfiguracaoRuntime(ambienteBase())
    ).toMatchObject({
      ambiente: "test",
      producao: false,
      whatsappAtivo: false,
      coletaMlNoShowAtiva: false,
    });
  });

  test("recusa segredo JWT fraco", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      JWT_SECRET: "curto",
    })).toThrow(
      "JWT_SECRET precisa ter pelo menos 32 caracteres."
    );
  });

  test("exige configuração financeira e URL HTTPS em produção", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      NODE_ENV: "production",
      PUBLIC_APP_URL: "http://app.agendafashion.com.br",
    })).toThrow("variáveis ausentes");

    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      NODE_ENV: "production",
      PUBLIC_APP_URL: "http://app.agendafashion.com.br",
      ASAAS_API_URL: "https://api.asaas.com/v3",
      ASAAS_API_KEY: "$aact_prod_teste",
      ASAAS_WEBHOOK_TOKEN: "token-webhook",
    })).toThrow("PUBLIC_APP_URL precisa usar HTTPS");
  });

  test("exige credenciais completas quando o WhatsApp está ativo", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      WHATSAPP_NOTIFICATIONS_ENABLED: "true",
      WHATSAPP_ACCESS_TOKEN: "token",
    })).toThrow("WhatsApp: variáveis ausentes");
  });

  test("recusa timeout inválido em vez de usar fallback silencioso", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      DB_QUERY_TIMEOUT: "vinte",
    })).toThrow("DB_QUERY_TIMEOUT precisa ser um inteiro");
  });

  test.each([
    [
      "PASSWORD_RESET_EMAIL_ENABLED",
      "E-mail de recuperação",
    ],
    ["GOOGLE_MEASUREMENT_ENABLED", "Google Measurement"],
    ["GA4_DATA_API_ENABLED", "GA4 Data API"],
    ["META_ADS_ENABLED", "Meta Ads"],
    ["GOOGLE_ADS_COSTS_ENABLED", "Custos Google Ads"],
    ["META_ADS_COSTS_ENABLED", "Custos Meta Ads"],
    ["TIKTOK_ADS_COSTS_ENABLED", "Custos TikTok Ads"],
    ["PINTEREST_ADS_COSTS_ENABLED", "Custos Pinterest Ads"],
    ["COPILOT_AI_ENABLED", "Copilot"],
  ])(
    "recusa integração %s habilitada parcialmente",
    (flag, contexto) => {
      expect(() => validarConfiguracaoRuntime({
        ...ambienteBase(),
        [flag]: "true",
      })).toThrow(`${contexto}: variáveis ausentes`);
    }
  );

  test("recusa flag ambígua e expõe o modo dos workers", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      BACKGROUND_WORKERS_ENABLED: "talvez",
    })).toThrow("BACKGROUND_WORKERS_ENABLED precisa ser uma flag booleana válida");

    expect(validarConfiguracaoRuntime({
      ...ambienteBase(),
      BACKGROUND_WORKERS_ENABLED: "false",
    })).toMatchObject({
      workersAtivos: false,
    });
  });

  test("valida a coleta de dados de ML e seus limites operacionais", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      ML_NO_SHOW_DATA_ENABLED: "talvez",
    })).toThrow(
      "ML_NO_SHOW_DATA_ENABLED precisa ser uma flag booleana válida"
    );

    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      ML_NO_SHOW_DATA_INTERVAL_MS: "1000",
    })).toThrow(
      "ML_NO_SHOW_DATA_INTERVAL_MS precisa ser um inteiro entre 60000 e 86400000"
    );

    expect(validarConfiguracaoRuntime({
      ...ambienteBase(),
      ML_NO_SHOW_DATA_ENABLED: "true",
      ML_NO_SHOW_DATA_INTERVAL_MS: "300000",
      ML_NO_SHOW_DATA_BATCH_SIZE: "100",
    })).toMatchObject({
      coletaMlNoShowAtiva: true,
    });
  });

  test("recusa credencial presente com formato inválido", () => {
    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      GOOGLE_MEASUREMENT_ENABLED: "true",
      GA4_MEASUREMENT_ID: "medicao-invalida",
      GA4_API_SECRET: "segredo",
    })).toThrow("GA4_MEASUREMENT_ID possui formato inválido");

    expect(() => validarConfiguracaoRuntime({
      ...ambienteBase(),
      TIKTOK_ADS_COSTS_ENABLED: "true",
      TIKTOK_ADVERTISER_ID: "123456",
      TIKTOK_APP_ID: "app",
      TIKTOK_APP_SECRET: "secret",
      TIKTOK_OAUTH_ENCRYPTION_KEY: "curta",
      TIKTOK_OAUTH_REDIRECT_URI: "https://app.example.com/callback",
    })).toThrow("TIKTOK_OAUTH_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres");
  });
});
