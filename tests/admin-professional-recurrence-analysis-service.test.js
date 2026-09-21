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

const recurrenceService = require(
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
const analysisService = require(
  "../src/services/adminProfessionalRecurrenceAnalysisService"
);

describe(
  "adminProfessionalRecurrenceAnalysisService",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "combina recorrencia, custo, monetizacao e prontidao sobre a mesma base",
      async () => {
        const agora =
          new Date(
            "2026-09-21T15:00:00.000Z"
          );
        const recorrencia = {
          periodo: "30",
          resumo: {
            comPrimeiroAgendamento: 5,
          },
        };
        const linhas = [
          {
            usuario_id: 9,
            campanha_oficial_id: 10,
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
            investimento_centavos: 5000,
          },
        ];
        const comCustos = {
          ...recorrencia,
          diagnosticoCustoAquisicao: {
            profissionaisOficiais: 1,
          },
        };
        const comMonetizacao = {
          ...comCustos,
          diagnosticoMonetizacaoRecorrencia: {
            diasMaturacaoMonetizacao: 21,
          },
        };
        const final = {
          ...comMonetizacao,
          diagnosticoProntidaoFinanceira: {
            minimoAssinaturas: 2,
          },
        };

        recurrenceService
          .buscarRecorrenciaComBase
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
          .mockReturnValue(final);

        await expect(
          analysisService.buscar({
            periodo: "30",
            agora,
          })
        ).resolves.toBe(final);

        expect(
          recurrenceService
            .buscarRecorrenciaComBase
        ).toHaveBeenCalledWith({
          periodo: "30",
          agora,
        });
        expect(
          acquisitionCostService
            .enriquecerRecorrencia
        ).toHaveBeenCalledWith({
          recorrencia,
          linhasRecorrencia: linhas,
          investimentos,
          investimentosDiarios,
          agora,
        });
        expect(
          monetizationService
            .enriquecerRecorrenciaComMonetizacao
        ).toHaveBeenCalledWith({
          recorrencia: comCustos,
          linhasRecorrencia: linhas,
          agora,
        });
        expect(
          financialReadinessService
            .enriquecerRecorrenciaComProntidaoFinanceira
        ).toHaveBeenCalledWith({
          recorrencia: comMonetizacao,
          linhasRecorrencia: linhas,
          investimentosDiarios,
          agora,
        });
      }
    );
  }
);
