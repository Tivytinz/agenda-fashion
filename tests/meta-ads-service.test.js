const crypto = require("crypto");

jest.mock(
  "../src/repositories/metaAdsRepository",
  () => ({
    salvarConsentimentoUsuario:
      jest.fn(),
    buscarPerfilPorUsuario:
      jest.fn(),
    buscarPerfilPorNegocio:
      jest.fn(),
    ehPrimeiroPagamentoAssinatura:
      jest.fn()
  })
);

const metaAdsRepository = require(
  "../src/repositories/metaAdsRepository"
);
const metaAdsService = require(
  "../src/services/metaAdsService"
);

const ENV_KEYS = [
  "META_ADS_ENABLED",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "META_GRAPH_API_VERSION",
  "META_CAPI_TEST_EVENT_CODE",
  "META_CAPI_TIMEOUT_MS",
  "PUBLIC_APP_URL"
];

function configurarMeta() {
  process.env.META_ADS_ENABLED =
    "true";
  process.env.META_PIXEL_ID =
    "123456789";
  process.env.META_CAPI_ACCESS_TOKEN =
    "token-super-secreto";
  process.env.META_GRAPH_API_VERSION =
    "v25.0";
  process.env.PUBLIC_APP_URL =
    "https://app.agendafashion.com.br";
}

function hash(valor) {
  return crypto
    .createHash("sha256")
    .update(valor)
    .digest("hex");
}

beforeEach(() => {
  jest.clearAllMocks();

  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  global.fetch = jest.fn();
});

afterAll(() => {
  delete global.fetch;
});

describe("Meta Ads service", () => {
  test("fica desativado por padrão e não expõe token", () => {
    process.env.META_CAPI_ACCESS_TOKEN =
      "nao-pode-vazar";

    expect(
      metaAdsService
        .obterConfiguracaoPublica()
    ).toEqual({
      enabled: false,
      pixelId: null
    });
  });

  test("sanitiza identificadores e recusa source URL externa", () => {
    process.env.PUBLIC_APP_URL =
      "https://app.agendafashion.com.br";

    expect(
      metaAdsService
        .sanitizarContextoCliente({
          consentimento: true,
          event_id:
            "af:test:12345678",
          fbp:
            "fb.1.123.456",
          fbc:
            "valor com espaço",
          source_url:
            "https://evil.example/roubo?token=1"
        })
    ).toEqual({
      consentimento: true,
      eventId:
        "af:test:12345678",
      fbp:
        "fb.1.123.456",
      fbc: null,
      sourceUrl:
        "https://app.agendafashion.com.br"
    });
  });

  test("distingue contexto ausente de uma recusa explícita", () => {
    expect(
      metaAdsService
        .sanitizarContextoCliente()
        .consentimento
    ).toBeNull();

    expect(
      metaAdsService
        .sanitizarContextoCliente({
          consentimento: false
        })
        .consentimento
    ).toBe(false);
  });

  test("envia hashes em vez de email e telefone em texto puro", async () => {
    configurarMeta();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        events_received: 1,
        fbtrace_id: "trace-1"
      })
    });

    const resultado =
      await metaAdsService.enviarEvento({
        eventName:
          "CompleteRegistration",
        eventId:
          "af:registration:12345678",
        usuarioId: 77,
        email:
          "Pessoa@Example.com",
        whatsapp:
          "(62) 99999-1234",
        contexto: {
          consentimento: true,
          sourceUrl:
            "https://app.agendafashion.com.br/cadastro",
          fbp:
            "fb.1.123.456",
          fbc:
            "fb.1.123.click",
          clientIp:
            "203.0.113.10",
          userAgent:
            "Jest Browser"
        }
      });

    expect(resultado.enviado)
      .toBe(true);
    expect(global.fetch)
      .toHaveBeenCalledTimes(1);

    const [url, options] =
      global.fetch.mock.calls[0];
    const payload =
      JSON.parse(options.body);
    const userData =
      payload.data[0].user_data;

    expect(url).toBe(
      "https://graph.facebook.com/v25.0/123456789/events"
    );
    expect(options.headers.Authorization)
      .toBe(
        "Bearer token-super-secreto"
      );
    expect(options.body)
      .not.toContain(
        "Pessoa@Example.com"
      );
    expect(options.body)
      .not.toContain(
        "99999-1234"
      );
    expect(userData.em).toEqual([
      hash("pessoa@example.com")
    ]);
    expect(userData.ph).toEqual([
      hash("5562999991234")
    ]);
    expect(userData.external_id)
      .toEqual([
        hash("77")
      ]);
  });

  test("não envia evento sem consentimento", async () => {
    configurarMeta();

    const resultado =
      await metaAdsService.enviarEvento({
        eventName:
          "CompleteRegistration",
        eventId:
          "af:registration:12345678",
        usuarioId: 77,
        contexto: {
          consentimento: false
        }
      });

    expect(resultado).toEqual({
      enviado: false,
      motivo: "sem_consentimento"
    });
    expect(global.fetch)
      .not.toHaveBeenCalled();
  });

  test("recusa explícita prevalece sobre consentimento antigo salvo", async () => {
    configurarMeta();

    const resultado =
      await metaAdsService.enviarEvento({
        eventName:
          "InitiateCheckout",
        eventId:
          "af:checkout:12345678",
        usuarioId: 77,
        contexto: {
          consentimento: false
        },
        perfil: {
          meta_consentido_em:
            new Date()
        }
      });

    expect(resultado).toEqual({
      enviado: false,
      motivo: "sem_consentimento"
    });
    expect(global.fetch)
      .not.toHaveBeenCalled();
  });

  test("não transforma renovação em nova assinatura", async () => {
    configurarMeta();
    metaAdsRepository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(false);

    metaAdsService
      .enviarAssinaturaAtivadaSeguro({
        negocioId: 10,
        assinaturaId: 20,
        pagamentoId: "pay_renovacao",
        valor: 49.9
      });

    await new Promise(
      (resolve) => setImmediate(resolve)
    );

    expect(
      metaAdsRepository
        .ehPrimeiroPagamentoAssinatura
    ).toHaveBeenCalledWith({
      assinaturaId: 20,
      pagamentoId: "pay_renovacao"
    });
    expect(
      metaAdsRepository
        .buscarPerfilPorNegocio
    ).not.toHaveBeenCalled();
    expect(global.fetch)
      .not.toHaveBeenCalled();
  });
});
