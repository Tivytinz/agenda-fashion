const express = require("express");
const request = require("supertest");

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    if (
      req.get("Authorization") !==
        "Bearer token-test"
    ) {
      return res.status(401).json({
        mensagem: "Não autenticado."
      });
    }

    req.user = { id: 7 };
    return next();
  }
);

jest.mock(
  "../src/services/googleMeasurementService",
  () => ({
    obterConfiguracaoPublica:
      jest.fn(),
    sanitizarContextoCliente:
      jest.fn(),
    salvarConsentimento:
      jest.fn()
  })
);

const service = require(
  "../src/services/googleMeasurementService"
);
const routes = require(
  "../src/routes/googleMeasurementRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(routes);
  app.use((erro, _req, res, _next) => {
    res.status(
      erro.statusCode ||
      erro.status ||
      500
    ).json({
      mensagem: erro.message
    });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  service
    .obterConfiguracaoPublica
    .mockReturnValue({
      enabled: true,
      measurementId:
        "G-ABCDEF1234",
      adsId: null,
      signUpLabel: null,
      beginCheckoutLabel: null
    });
  service
    .sanitizarContextoCliente
    .mockImplementation((body) => ({
      consentimento:
        body.consentimento === true,
      clientId:
        body.client_id || null,
      textoVersao:
        body.texto_versao ||
        "legado-sem-versao"
    }));
  service
    .salvarConsentimento
    .mockResolvedValue({
      usuario_id: 7
    });
});

describe("rotas Google Measurement", () => {
  test("expõe somente a configuração pública", async () => {
    const response = await request(
      criarApp()
    )
      .get("/marketing/google/config")
      .expect(200);

    expect(response.body).toEqual({
      enabled: true,
      measurementId:
        "G-ABCDEF1234",
      adsId: null,
      signUpLabel: null,
      beginCheckoutLabel: null
    });
  });

  test("protege a persistência de consentimento", async () => {
    await request(criarApp())
      .post(
        "/marketing/google/consentimento"
      )
      .send({ consentimento: true })
      .expect(401);

    expect(
      service.salvarConsentimento
    ).not.toHaveBeenCalled();
  });

  test("valida e salva consentimento da conta autenticada", async () => {
    const response = await request(
      criarApp()
    )
      .post(
        "/marketing/google/consentimento"
      )
      .set(
        "Authorization",
        "Bearer token-test"
      )
      .send({
        consentimento: true,
        client_id:
          "123456.987654",
        texto_versao: "2026-08-25"
      })
      .expect(200);

    expect(
      service
        .sanitizarContextoCliente
    ).toHaveBeenCalledWith({
      consentimento: true,
      client_id:
        "123456.987654",
      texto_versao: "2026-08-25"
    });
    expect(
      service.salvarConsentimento
    ).toHaveBeenCalledWith({
      usuarioId: 7,
      google: {
        consentimento: true,
        client_id:
          "123456.987654",
        texto_versao: "2026-08-25"
      }
    });
    expect(response.body).toEqual({
      salvo: true,
      consentimento: true
    });
  });

  test("rejeita escolha ausente", async () => {
    await request(criarApp())
      .post(
        "/marketing/google/consentimento"
      )
      .set(
        "Authorization",
        "Bearer token-test"
      )
      .send({})
      .expect(400);

    expect(
      service.salvarConsentimento
    ).not.toHaveBeenCalled();
  });
});
