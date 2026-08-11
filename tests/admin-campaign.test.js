const express = require(
  "express"
);

const request = require(
  "supertest"
);

jest.mock(
  "../src/middlewares/auth",
  () => (
    req,
    res,
    next
  ) => {
    if (
      req.headers[
        "x-test-auth"
      ] === "no"
    ) {
      return res
        .status(401)
        .json({
          erro:
            "Usuário não autenticado.",
        });
    }

    req.user = {
      id: 7,
    };

    return next();
  }
);

jest.mock(
  "../src/middlewares/authAdmin",
  () => (
    req,
    res,
    next
  ) => {
    if (
      req.headers[
        "x-test-admin"
      ] === "no"
    ) {
      return res
        .status(403)
        .json({
          erro:
            "Acesso restrito aos administradores da plataforma.",
        });
    }

    req.admin = {
      usuarioId: 7,
      papel: "admin",
      superadmin: false,
    };

    return next();
  }
);

jest.mock(
  "../src/services/adminCampaignService",
  () => ({
    listarCampanhas:
      jest.fn(),
    criarCampanha:
      jest.fn(),
    atualizarCampanha:
      jest.fn(),
  })
);

const adminCampaignService =
  require(
    "../src/services/adminCampaignService"
  );

const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();

  app.use(
    express.json()
  );

  app.use(
    adminRoutes
  );

  app.use(
    (
      erro,
      req,
      res,
      next
    ) => res
      .status(
        erro?.statusCode ||
        500
      )
      .json({
        erro:
          erro.message,
      })
  );

  return app;
}

describe(
  "gestão administrativa de campanhas",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "protege a listagem com permissão administrativa",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/gestao-campanhas"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          adminCampaignService
            .listarCampanhas
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "lista campanhas gerenciadas",
      async () => {
        adminCampaignService
          .listarCampanhas
          .mockResolvedValue({
            campanhas: [
              {
                id: 10,
                nome:
                  "Cílios Goiânia",
                ativo: true,
              },
            ],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/gestao-campanhas"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body.campanhas
        ).toHaveLength(1);
      }
    );

    test(
      "cria campanha vinculada ao administrador autenticado",
      async () => {
        adminCampaignService
          .criarCampanha
          .mockResolvedValue({
            campanha: {
              id: 11,
              nome:
                "Google Unhas",
            },
          });

        const payload = {
          nome:
            "Google Unhas",
          canal:
            "google",
          destinoPath:
            "/",
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/marketing/gestao-campanhas"
            )
            .send(payload);

        expect(
          resposta.status
        ).toBe(201);

        expect(
          adminCampaignService
            .criarCampanha
        ).toHaveBeenCalledWith({
          payload,
          usuarioId: 7,
        });
      }
    );

    test(
      "atualiza status da campanha sem trocar identidade",
      async () => {
        adminCampaignService
          .atualizarCampanha
          .mockResolvedValue({
            campanha: {
              id: 11,
              ativo: false,
            },
          });

        const resposta =
          await request(
            criarApp()
          )
            .patch(
              "/admin/marketing/gestao-campanhas/11"
            )
            .send({
              ativo: false,
            });

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminCampaignService
            .atualizarCampanha
        ).toHaveBeenCalledWith({
          id: "11",
          payload: {
            ativo: false,
          },
        });
      }
    );
  }
);
