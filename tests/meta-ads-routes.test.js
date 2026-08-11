const express = require("express");
const request = require("supertest");

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    const userId =
      req.get("x-test-user-id");

    if (!userId) {
      return res.status(401).json({
        erro: "Usuário não autenticado."
      });
    }

    req.user = {
      id: Number(userId)
    };
    return next();
  }
);

jest.mock(
  "../src/controllers/metaAdsController",
  () => ({
    configuracaoPublica:
      jest.fn((req, res) =>
        res.status(200).json({
          enabled: false,
          pixelId: null
        })
      ),
    atualizarConsentimento:
      jest.fn((req, res) =>
        res.status(200).json({
          salvo: true,
          consentimento:
            req.body.consentimento
        })
      )
  })
);

const controller = require(
  "../src/controllers/metaAdsController"
);
const metaAdsRoutes = require(
  "../src/routes/metaAdsRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(metaAdsRoutes);
  return app;
}

describe("rotas Meta Ads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("mantém a configuração pública acessível sem login", async () => {
    const resposta = await request(
      criarApp()
    ).get(
      "/marketing/meta/config"
    );

    expect(resposta.status).toBe(200);
    expect(
      controller.configuracaoPublica
    ).toHaveBeenCalledTimes(1);
  });

  test("protege a alteração de consentimento com autenticação", async () => {
    const app = criarApp();

    const negada = await request(app)
      .post(
        "/marketing/meta/consentimento"
      )
      .send({
        consentimento: false
      });

    expect(negada.status).toBe(401);
    expect(
      controller.atualizarConsentimento
    ).not.toHaveBeenCalled();

    const autorizada = await request(app)
      .post(
        "/marketing/meta/consentimento"
      )
      .set(
        "x-test-user-id",
        "42"
      )
      .send({
        consentimento: true
      });

    expect(autorizada.status).toBe(200);
    expect(
      controller.atualizarConsentimento
    ).toHaveBeenCalledTimes(1);
  });
});
