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
  "../src/services/adminMarketingCostService",
  () => ({
    buscarCustos: jest.fn(),
    listarGastos: jest.fn(),
    registrarGasto: jest.fn(),
  })
);

const adminMarketingCostService =
  require(
    "../src/services/adminMarketingCostService"
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
  "custos de marketing administrativo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "protege custos com autenticação de administrador",
      async () => {
        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/custos"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);

        expect(
          adminMarketingCostService
            .buscarCustos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha período para relatório de investimento e CPA",
      async () => {
        adminMarketingCostService
          .buscarCustos
          .mockResolvedValue({
            periodo: "7",
            investimentoCentavos: 20000,
            sessoes: 100,
            agendamentosConcluidos: 10,
            custoPorSessaoCentavos: 200,
            cpaCentavos: 2000,
            campanhas: [],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/custos?periodo=7"
            );

        expect(resposta.status)
          .toBe(200);

        expect(
          adminMarketingCostService
            .buscarCustos
        ).toHaveBeenCalledWith({
          periodo: "7",
        });

        expect(
          resposta.body.cpaCentavos
        ).toBe(2000);
      }
    );

    test(
      "registra investimento usando o usuário autenticado",
      async () => {
        adminMarketingCostService
          .registrarGasto
          .mockResolvedValue({
            gasto: {
              id: 31,
              campanhaId: 4,
              dataGasto:
                "2026-08-10",
              valorCentavos: 15990,
            },
          });

        const payload = {
          campanhaId: 4,
          dataGasto:
            "2026-08-10",
          valorCentavos: 15990,
        };

        const resposta =
          await request(
            criarApp()
          )
            .post(
              "/admin/marketing/gastos"
            )
            .send(payload);

        expect(resposta.status)
          .toBe(200);

        expect(
          adminMarketingCostService
            .registrarGasto
        ).toHaveBeenCalledWith({
          payload,
          usuarioId: 7,
        });
      }
    );

    test(
      "lista lançamentos de investimento por período",
      async () => {
        adminMarketingCostService
          .listarGastos
          .mockResolvedValue({
            periodo: "30",
            gastos: [
              {
                id: 1,
                campanhaId: 3,
                valorCentavos: 5000,
              },
            ],
          });

        const resposta =
          await request(
            criarApp()
          )
            .get(
              "/admin/marketing/gastos?periodo=30"
            );

        expect(resposta.status)
          .toBe(200);

        expect(
          resposta.body.gastos
        ).toHaveLength(1);
      }
    );
  }
);
