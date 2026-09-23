const mockSyncService = {
  sincronizarPendentes:
    jest.fn(),
};

const mockMetrics = {
  registrarWorkerIniciado:
    jest.fn(),
  registrarWorkerParado:
    jest.fn(),
  registrarExecucaoIniciada:
    jest.fn(),
  registrarExecucaoConcluida:
    jest.fn(),
  registrarExecucaoFalha:
    jest.fn(),
};

const mockRegistrador = {
  informacao:
    jest.fn(),
  aviso:
    jest.fn(),
};

jest.mock(
  "../src/services/contributionCostSyncService",
  () => mockSyncService
);

jest.mock(
  "../src/services/operationalMetricsService",
  () => mockMetrics
);

jest.mock(
  "../src/utils/registrador",
  () => mockRegistrador
);

describe(
  "Wave 32 - worker de custos de contribuição",
  () => {
    const original =
      process.env
        .CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED;

    beforeEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
      delete process.env
        .CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED;

      mockSyncService
        .sincronizarPendentes
        .mockResolvedValue({
          integracoes: 0,
          resultados: [],
        });
    });

    afterAll(() => {
      if (
        original === undefined
      ) {
        delete process.env
          .CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED;
      } else {
        process.env
          .CONTRIBUTION_COST_SYNC_SCHEDULE_ENABLED =
          original;
      }
    });

    test(
      "fica desligado sem flag explícita",
      () => {
        const worker = require(
          "../src/services/contributionCostSyncWorker"
        );

        expect(
          worker
            .iniciarWorkerCustosContribuicao()
        ).toBe(false);

        expect(
          mockMetrics
            .registrarWorkerParado
        ).toHaveBeenCalledWith(
          "contribution_cost_sync"
        );
      }
    );

    test(
      "marca sucesso quando não há integração vencida",
      async () => {
        const worker = require(
          "../src/services/contributionCostSyncWorker"
        );

        const resultado =
          await worker
            .executarSincronizacaoAgendada();

        expect(resultado)
          .toMatchObject({
            ignorado: false,
            integracoes: 0,
            resultados: [],
          });

        expect(
          mockMetrics
            .registrarExecucaoConcluida
        ).toHaveBeenCalledWith(
          "contribution_cost_sync"
        );
      }
    );

    test(
      "propaga saúde degradada quando alguma integração falha",
      async () => {
        mockSyncService
          .sincronizarPendentes
          .mockResolvedValue({
            integracoes: 2,
            resultados: [
              {
                integracaoId: 1,
                status: "sucesso",
              },
              {
                integracaoId: 2,
                fonteCodigo:
                  "mensageria",
                adaptador:
                  "provider_test",
                status: "erro",
                erroCodigo:
                  "http_502",
              },
            ],
          });

        const worker = require(
          "../src/services/contributionCostSyncWorker"
        );

        const resultado =
          await worker
            .executarSincronizacaoAgendada();

        expect(
          resultado.resultados
        ).toHaveLength(2);

        expect(
          mockMetrics
            .registrarExecucaoFalha
        ).toHaveBeenCalledWith(
          "contribution_cost_sync",
          expect.any(Error)
        );

        expect(
          mockRegistrador.aviso
        ).toHaveBeenCalled();
      }
    );

    test(
      "limita intervalo entre uma e vinte e quatro horas",
      () => {
        process.env
          .CONTRIBUTION_COST_SYNC_INTERVAL_HOURS =
          "0.1";
        let worker = require(
          "../src/services/contributionCostSyncWorker"
        );

        expect(
          worker.intervaloHoras()
        ).toBe(1);

        jest.resetModules();

        process.env
          .CONTRIBUTION_COST_SYNC_INTERVAL_HOURS =
          "40";
        worker = require(
          "../src/services/contributionCostSyncWorker"
        );

        expect(
          worker.intervaloHoras()
        ).toBe(24);
      }
    );
  }
);
