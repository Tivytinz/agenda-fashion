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
  "../src/services/adminProfessionalRecurrenceService",
  () => ({
    buscarRecorrencia:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalAcquisitionCostService",
  () => ({
    buscarInvestimentos:
      jest.fn(),
    enriquecerRecorrencia:
      jest.fn(),
  })
);

const service = require(
  "../src/services/adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "../src/services/adminProfessionalAcquisitionCostService"
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
  "rota de recorrencia profissional",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      acquisitionCostService
        .buscarInvestimentos
        .mockResolvedValue([]);
      acquisitionCostService
        .enriquecerRecorrencia
        .mockImplementation(
          ({ recorrencia }) =>
            recorrencia
        );
    });

    test(
      "exige administrador",
      async () => {
        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/recorrencia-profissionais"
            )
            .set(
              "x-test-admin",
              "no"
            );

        expect(resposta.status)
          .toBe(403);
        expect(
          service.buscarRecorrencia
        ).not.toHaveBeenCalled();
        expect(
          acquisitionCostService
            .buscarInvestimentos
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha o periodo, combina investimento e retorna a recorrencia observada",
      async () => {
        const recorrencia = {
          periodo: "7",
          resumo: {
            comPrimeiroAgendamento: 4,
            comSegundoAgendamento: 3,
            comTerceiroAgendamento: 2,
          },
        };
        const investimentos = [
          {
            campanha_id: 10,
            investimento_centavos: 5000,
          },
        ];

        service.buscarRecorrencia
          .mockResolvedValue(
            recorrencia
          );
        acquisitionCostService
          .buscarInvestimentos
          .mockResolvedValue(
            investimentos
          );
        acquisitionCostService
          .enriquecerRecorrencia
          .mockReturnValue({
            ...recorrencia,
            diagnosticoCustoAquisicao: {
              profissionaisOficiais: 4,
            },
          });

        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/recorrencia-profissionais?periodo=7"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          service.buscarRecorrencia
        ).toHaveBeenCalledWith({
          periodo: "7",
        });
        expect(
          acquisitionCostService
            .buscarInvestimentos
        ).toHaveBeenCalledWith("7");
        expect(
          acquisitionCostService
            .enriquecerRecorrencia
        ).toHaveBeenCalledWith({
          recorrencia,
          investimentos,
        });
        expect(
          resposta.body.resumo
            .comTerceiroAgendamento
        ).toBe(2);
        expect(
          resposta.body
            .diagnosticoCustoAquisicao
            .profissionaisOficiais
        ).toBe(4);
      }
    );
  }
);