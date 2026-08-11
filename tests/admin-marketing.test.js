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
  "../src/services/adminMarketingService",
  () => ({
    buscarResumo:
      jest.fn(),
    listarCampanhas:
      jest.fn(),
    listarConversoes:
      jest.fn(),
  })
);

const adminMarketingService =
  require(
    "../src/services/adminMarketingService"
  );

const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app =
    express();

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
  "marketing administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "protege as métricas de atribuição com autenticação de admin",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/resumo"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(
          resposta.status
        ).toBe(403);

        expect(
          adminMarketingService
            .buscarResumo
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha período para o resumo de marketing",
      async () => {
        adminMarketingService
          .buscarResumo
          .mockResolvedValue({
            periodo: "7",
            sessoes: 12,
            campanhas: 2,
            agendamentosConcluidos: 3,
            taxaConversao: 25,
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/resumo?periodo=7"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          adminMarketingService
            .buscarResumo
        ).toHaveBeenCalledWith({
          periodo: "7",
        });

        expect(
          resposta.body
            .taxaConversao
        ).toBe(25);
      }
    );

    test(
      "lista campanhas atribuídas",
      async () => {
        adminMarketingService
          .listarCampanhas
          .mockResolvedValue({
            periodo: "30",
            campanhas: [
              {
                origem: "facebook",
                midia: "cpc",
                campanha: "goiania_cilios",
                sessoes: 20,
                agendamentosConcluidos: 4,
                taxaConversao: 20,
              },
            ],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/campanhas?periodo=30"
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
      "lista conversões sem exigir dados pessoais do cliente",
      async () => {
        adminMarketingService
          .listarConversoes
          .mockResolvedValue({
            periodo: "30",
            conversoes: [
              {
                eventoId: 9,
                negocioId: 4,
                campanha: "goiania_cilios",
              },
            ],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/conversoes"
            );

        expect(
          resposta.status
        ).toBe(200);

        expect(
          resposta.body
            .conversoes[0]
        ).not.toHaveProperty(
          "clienteNome"
        );

        expect(
          resposta.body
            .conversoes[0]
        ).not.toHaveProperty(
          "clienteWhatsapp"
        );
      }
    );
  }
);
