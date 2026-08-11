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
    req.user = { id: 7 };
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
    };
    return next();
  }
);

jest.mock(
  "../src/services/adminProfessionalFunnelService",
  () => ({
    buscarFunil:
      jest.fn(),
  })
);

const service = require(
  "../src/services/adminProfessionalFunnelService"
);
const adminRoutes = require(
  "../src/routes/adminRoutes"
);

function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRoutes);
  app.use(
    (
      erro,
      req,
      res,
      next
    ) => res
      .status(
        erro?.statusCode || 500
      )
      .json({
        erro: erro.message,
      })
  );
  return app;
}

describe(
  "rota do funil profissional",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "exige administrador",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/funil-profissionais"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);
        expect(service.buscarFunil)
          .not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha o período e retorna a coorte",
      async () => {
        service.buscarFunil
          .mockResolvedValue({
            periodo: "7",
            resumo: {
              cadastros: 10,
              assinaturasAtivadas: 2,
            },
            campanhas: [],
          });

        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/funil-profissionais?periodo=7"
            );

        expect(resposta.status)
          .toBe(200);
        expect(service.buscarFunil)
          .toHaveBeenCalledWith({
            periodo: "7",
          });
        expect(
          resposta.body.resumo
            .assinaturasAtivadas
        ).toBe(2);
      }
    );
  }
);
