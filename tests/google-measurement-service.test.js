jest.mock(
  "../src/repositories/googleMeasurementRepository",
  () => ({
    salvarConsentimentoUsuario:
      jest.fn(),
    buscarPerfilPorNegocio:
      jest.fn(),
    ehPrimeiroPagamentoAssinatura:
      jest.fn()
  })
);

const repository = require(
  "../src/repositories/googleMeasurementRepository"
);
const service = require(
  "../src/services/googleMeasurementService"
);

const ENV_KEYS = [
  "GOOGLE_MEASUREMENT_ENABLED",
  "GA4_MEASUREMENT_ID",
  "GA4_API_SECRET",
  "GOOGLE_ADS_ID",
  "GOOGLE_ADS_SIGNUP_LABEL",
  "GOOGLE_ADS_CHECKOUT_LABEL",
  "GOOGLE_MEASUREMENT_TIMEOUT_MS"
];

function configurarGoogle() {
  process.env.GOOGLE_MEASUREMENT_ENABLED =
    "true";
  process.env.GA4_MEASUREMENT_ID =
    "G-ABCDEF1234";
  process.env.GA4_API_SECRET =
    "segredo-ga4";
  process.env.GOOGLE_ADS_ID =
    "AW-123456789";
  process.env.GOOGLE_ADS_SIGNUP_LABEL =
    "signupLabel1";
  process.env.GOOGLE_ADS_CHECKOUT_LABEL =
    "checkoutLabel1";
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

describe("Google Measurement service", () => {
  test("fica desligado por padrão e não expõe API secret", () => {
    process.env.GA4_API_SECRET =
      "nao-pode-vazar";

    expect(
      service.obterConfiguracaoPublica()
    ).toEqual({
      enabled: false,
      measurementId: null,
      adsId: null,
      signUpLabel: null,
      beginCheckoutLabel: null
    });

    expect(
      JSON.stringify(
        service.obterConfiguracaoPublica()
      )
    ).not.toContain(
      "nao-pode-vazar"
    );
  });

  test("expõe somente IDs e labels públicos válidos", () => {
    configurarGoogle();

    expect(
      service.obterConfiguracaoPublica()
    ).toEqual({
      enabled: true,
      measurementId:
        "G-ABCDEF1234",
      adsId:
        "AW-123456789",
      signUpLabel:
        "signupLabel1",
      beginCheckoutLabel:
        "checkoutLabel1"
    });
  });

  test("sanitiza client id e não o aceita sem consentimento", () => {
    expect(
      service.sanitizarContextoCliente({
        consentimento: true,
        client_id: "123456.987654",
        texto_versao: "2026-08-25"
      })
    ).toEqual({
      consentimento: true,
      clientId: "123456.987654",
      textoVersao: "2026-08-25"
    });

    expect(
      service.sanitizarContextoCliente({
        consentimento: false,
        client_id: "123456.987654"
      })
    ).toEqual({
      consentimento: false,
      clientId: null,
      textoVersao: "legado-sem-versao"
    });

    expect(
      service.sanitizarContextoCliente({
        consentimento: true,
        client_id: "id inválido"
      }).clientId
    ).toBeNull();
  });

  test("persiste origem segura e a versão validada do texto", async () => {
    repository
      .salvarConsentimentoUsuario
      .mockResolvedValue({ usuario_id: 7 });

    await service.salvarConsentimento({
      usuarioId: 7,
      google: {
        consentimento: true,
        client_id: "123456.987654",
        texto_versao: "2026-08-25",
        origem: "FORJADA"
      }
    });

    expect(
      repository.salvarConsentimentoUsuario
    ).toHaveBeenCalledWith({
      usuarioId: 7,
      consentido: true,
      clientId: "123456.987654",
      origem: "NAVEGADOR",
      textoVersao: "2026-08-25"
    });
  });

  test("envia purchase pelo Measurement Protocol com transaction id", async () => {
    configurarGoogle();
    global.fetch.mockResolvedValue({
      ok: true
    });

    const resultado =
      await service
        .enviarEventoMeasurementProtocol({
          clientId:
            "123456.987654",
          userId: 77,
          eventName: "purchase",
          params: {
            transaction_id:
              "af-subscription-20",
            currency: "BRL",
            value: 49.9
          }
        });

    expect(resultado).toEqual({
      enviado: true
    });
    expect(global.fetch)
      .toHaveBeenCalledTimes(1);

    const [url, options] =
      global.fetch.mock.calls[0];
    const payload =
      JSON.parse(options.body);

    expect(url).toContain(
      "https://www.google-analytics.com/mp/collect?"
    );
    expect(url).toContain(
      "measurement_id=G-ABCDEF1234"
    );
    expect(url).toContain(
      "api_secret=segredo-ga4"
    );
    expect(payload).toMatchObject({
      client_id: "123456.987654",
      user_id: "77",
      events: [
        {
          name: "purchase",
          params: {
            transaction_id:
              "af-subscription-20",
            currency: "BRL",
            value: 49.9,
            engagement_time_msec: 1
          }
        }
      ]
    });
  });

  test("não envia Measurement Protocol sem client id válido", async () => {
    configurarGoogle();

    expect(
      await service
        .enviarEventoMeasurementProtocol({
          clientId: "",
          eventName: "purchase"
        })
    ).toEqual({
      enviado: false,
      motivo: "client_id_invalido"
    });
    expect(global.fetch)
      .not.toHaveBeenCalled();
  });

  test("não transforma renovação em nova compra", async () => {
    configurarGoogle();
    repository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(false);

    service
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
      repository
        .ehPrimeiroPagamentoAssinatura
    ).toHaveBeenCalledWith({
      assinaturaId: 20,
      pagamentoId:
        "pay_renovacao"
    });
    expect(
      repository.buscarPerfilPorNegocio
    ).not.toHaveBeenCalled();
    expect(global.fetch)
      .not.toHaveBeenCalled();
  });

  test("envia primeira assinatura somente com consentimento e client id persistidos", async () => {
    configurarGoogle();
    repository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(true);
    repository
      .buscarPerfilPorNegocio
      .mockResolvedValue({
        usuario_id: 77,
        google_consentimento_status:
          true,
        google_consentido_em:
          new Date().toISOString(),
        google_revogado_em:
          null,
        google_client_id:
          "123456.987654"
      });
    global.fetch.mockResolvedValue({
      ok: true
    });

    service
      .enviarAssinaturaAtivadaSeguro({
        negocioId: 10,
        assinaturaId: 20,
        pagamentoId: "pay_primeiro",
        valor: 49.9
      });

    await new Promise(
      (resolve) => setImmediate(resolve)
    );
    await new Promise(
      (resolve) => setImmediate(resolve)
    );

    expect(global.fetch)
      .toHaveBeenCalledTimes(1);

    const payload = JSON.parse(
      global.fetch.mock.calls[0][1].body
    );
    expect(payload.events[0])
      .toMatchObject({
        name: "purchase",
        params: {
          transaction_id:
            "af-subscription-20",
          currency: "BRL",
          value: 49.9
        }
      });
  });

  test("não envia compra quando a última escolha explícita é recusa", async () => {
    configurarGoogle();
    repository
      .ehPrimeiroPagamentoAssinatura
      .mockResolvedValue(true);
    repository
      .buscarPerfilPorNegocio
      .mockResolvedValue({
        usuario_id: 77,
        google_consentimento_status:
          false,
        google_consentido_em:
          new Date().toISOString(),
        google_revogado_em:
          new Date().toISOString(),
        google_client_id:
          "123456.987654"
      });

    service
      .enviarAssinaturaAtivadaSeguro({
        negocioId: 10,
        assinaturaId: 20,
        pagamentoId: "pay_recusado",
        valor: 49.9
      });

    await new Promise(
      (resolve) => setImmediate(resolve)
    );
    await new Promise(
      (resolve) => setImmediate(resolve)
    );

    expect(global.fetch)
      .not.toHaveBeenCalled();
  });
});
