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
});
