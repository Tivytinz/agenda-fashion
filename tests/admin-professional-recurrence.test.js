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
    buscarRecorrenciaComBase:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalAcquisitionCostService",
  () => ({
    buscarInvestimentos:
      jest.fn(),
    buscarInvestimentosDiarios:
      jest.fn(),
    enriquecerRecorrencia:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceMonetizationService",
  () => ({
    enriquecerRecorrenciaComMonetizacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceFinancialReadinessService",
  () => ({
    enriquecerRecorrenciaComProntidaoFinanceira:
      jest.fn(),
  })
);

jest.mock(
  "../src/services/adminProfessionalRecurrenceFinancialDiagnosisService",
  () => ({
    enriquecerRecorrenciaComDiagnosticoExecutivo:
      jest.fn(),
  })
);

const service = require(
  "../src/services/adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "../src/services/adminProfessionalAcquisitionCostService"
);
const monetizationService = require(
  "../src/services/adminProfessionalRecurrenceMonetizationService"
);
const financialReadinessService = require(
  "../src/services/adminProfessionalRecurrenceFinancialReadinessService"
);
const financialDiagnosisService = require(
  "../src/services/adminProfessionalRecurrenceFinancialDiagnosisService"
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
        .buscarInvestimentosDiarios
        .mockResolvedValue([]);
      acquisitionCostService
        .enriquecerRecorrencia
        .mockImplementation(
          ({ recorrencia }) =>
            recorrencia
        );
      monetizationService
        .enriquecerRecorrenciaComMonetizacao
        .mockImplementation(
          ({ recorrencia }) =>
            recorrencia
        );
      financialReadinessService
        .enriquecerRecorrenciaComProntidaoFinanceira
        .mockImplementation(
          ({ recorrencia }) =>
            recorrencia
        );
      financialDiagnosisService
        .enriquecerRecorrenciaComDiagnosticoExecutivo
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
          service.buscarRecorrenciaComBase
        ).not.toHaveBeenCalled();
        expect(
          acquisitionCostService
            .buscarInvestimentos
        ).not.toHaveBeenCalled();
        expect(
          acquisitionCostService
            .buscarInvestimentosDiarios
        ).not.toHaveBeenCalled();
        expect(
          monetizationService
            .enriquecerRecorrenciaComMonetizacao
        ).not.toHaveBeenCalled();
        expect(
          financialReadinessService
            .enriquecerRecorrenciaComProntidaoFinanceira
        ).not.toHaveBeenCalled();
        expect(
          financialDiagnosisService
            .enriquecerRecorrenciaComDiagnosticoExecutivo
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "encaminha o periodo e combina custo, monetizacao, prontidao e diagnostico executivo sobre a mesma base",
      async () => {
        const recorrencia = {
          periodo: "7",
          resumo: {
            comPrimeiroAgendamento: 4,
            comSegundoAgendamento: 3,
            comTerceiroAgendamento: 2,
          },
        };
        const linhas = [
          {
            usuario_id: 9,
            campanha_oficial_id: 10,
            pagamento_inicial_valido: true,
          },
        ];
        const investimentos = [
          {
            campanha_id: 10,
            investimento_centavos: 5000,
          },
        ];
        const investimentosDiarios = [
          {
            campanha_id: 10,
            data_gasto: "2026-08-01",
            idade_dias: 28,
            investimento_centavos: 5000,
          },
        ];
        const comCustos = {
          ...recorrencia,
          diagnosticoCustoAquisicao: {
            profissionaisOficiais: 4,
          },
        };
        const comMonetizacao = {
          ...comCustos,
          diagnosticoMonetizacaoRecorrencia: {
            diasMaturacaoMonetizacao: 21,
          },
        };
        const comProntidao = {
          ...comMonetizacao,
          diagnosticoProntidaoFinanceira: {
            minimoAssinaturas: 2,
          },
        };
        const comDiagnostico = {
          ...comProntidao,
          diagnosticoExecutivoProntidaoFinanceira: {
            resumo: {
              campanhas: 1,
              bloqueadas: 0,
            },
          },
        };

        service.buscarRecorrenciaComBase
          .mockResolvedValue({
            recorrencia,
            linhas,
          });
        acquisitionCostService
          .buscarInvestimentos
          .mockResolvedValue(
            investimentos
          );
        acquisitionCostService
          .buscarInvestimentosDiarios
          .mockResolvedValue(
            investimentosDiarios
          );
        acquisitionCostService
          .enriquecerRecorrencia
          .mockReturnValue(comCustos);
        monetizationService
          .enriquecerRecorrenciaComMonetizacao
          .mockReturnValue(comMonetizacao);
        financialReadinessService
          .enriquecerRecorrenciaComProntidaoFinanceira
          .mockReturnValue(comProntidao);
        financialDiagnosisService
          .enriquecerRecorrenciaComDiagnosticoExecutivo
          .mockReturnValue(comDiagnostico);

        const resposta =
          await request(criarApp())
            .get(
              "/admin/marketing/recorrencia-profissionais?periodo=7"
            );

        expect(resposta.status)
          .toBe(200);
        expect(
          service.buscarRecorrenciaComBase
        ).toHaveBeenCalledWith({
          periodo: "7",
        });
        expect(
          acquisitionCostService
            .enriquecerRecorrencia
        ).toHaveBeenCalledWith({
          recorrencia,
          linhasRecorrencia: linhas,
          investimentos,
          investimentosDiarios,
        });
        expect(
          monetizationService
            .enriquecerRecorrenciaComMonetizacao
        ).toHaveBeenCalledWith({
          recorrencia: comCustos,
          linhasRecorrencia: linhas,
        });
        expect(
          financialReadinessService
            .enriquecerRecorrenciaComProntidaoFinanceira
        ).toHaveBeenCalledWith({
          recorrencia: comMonetizacao,
          linhasRecorrencia: linhas,
          investimentosDiarios,
        });
        expect(
          financialDiagnosisService
            .enriquecerRecorrenciaComDiagnosticoExecutivo
        ).toHaveBeenCalledWith({
          recorrencia: comProntidao,
        });
        expect(
          resposta.body
            .diagnosticoExecutivoProntidaoFinanceira
            .resumo.campanhas
        ).toBe(1);
      }
    );
  }
);