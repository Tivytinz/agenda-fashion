const mockListar = jest.fn();
const mockMaterializar = jest.fn();

jest.mock(
  "../src/repositories/aquisicaoFinanceiraRepository",
  () => ({
    listarConversoesPendentes:
      mockListar,
    materializarAquisicaoPorEvento:
      mockMaterializar,
  })
);

jest.mock(
  "../src/services/operationalMetricsService",
  () => ({
    registrarExecucaoIniciada:
      jest.fn(),
    registrarExecucaoConcluida:
      jest.fn(),
    registrarExecucaoFalha:
      jest.fn(),
    registrarWorkerIniciado:
      jest.fn(),
    registrarWorkerParado:
      jest.fn(),
  })
);

jest.mock(
  "../src/utils/registrador",
  () => ({
    informacao: jest.fn(),
    aviso: jest.fn(),
  })
);

const worker = require(
  "../src/services/aquisicaoFinanceiraReconciliationWorker"
);
const registrador = require(
  "../src/utils/registrador"
);

describe(
  "aquisicaoFinanceiraReconciliationWorker",
  () => {
    const envOriginal = process.env;

    beforeEach(async () => {
      jest.clearAllMocks();
      process.env = {
        ...envOriginal,
        ACQUISITION_FINANCIAL_RECONCILIATION_BATCH_SIZE:
          "25",
        ACQUISITION_FINANCIAL_RECONCILIATION_INTERVAL_MS:
          "60000",
      };
      await worker
        .pararWorkerAquisicaoFinanceira();
    });

    afterEach(async () => {
      await worker
        .pararWorkerAquisicaoFinanceira();
      process.env = envOriginal;
    });

    test(
      "materializa lote idempotente de conversões pendentes",
      async () => {
        mockListar.mockResolvedValue([
          {
            evento_id: 10,
            negocio_id: 7,
          },
          {
            evento_id: 11,
            negocio_id: 8,
          },
        ]);
        mockMaterializar
          .mockResolvedValueOnce({
            id: 1,
          })
          .mockResolvedValueOnce(null);

        await expect(
          worker.executarReconciliacao()
        ).resolves.toMatchObject({
          ignorado: false,
          candidatos: 2,
          materializados: 1,
          falhas: 0,
        });

        expect(mockListar)
          .toHaveBeenCalledWith(25);
        expect(mockMaterializar)
          .toHaveBeenNthCalledWith(
            1,
            10
          );
        expect(mockMaterializar)
          .toHaveBeenNthCalledWith(
            2,
            11
          );
      }
    );

    test(
      "isola falha de um negócio e continua o lote",
      async () => {
        mockListar.mockResolvedValue([
          {
            evento_id: 20,
            negocio_id: 70,
          },
          {
            evento_id: 21,
            negocio_id: 71,
          },
        ]);
        mockMaterializar
          .mockRejectedValueOnce(
            new Error("falha transitória")
          )
          .mockResolvedValueOnce({
            id: 2,
          });

        await expect(
          worker.executarReconciliacao()
        ).resolves.toMatchObject({
          candidatos: 2,
          materializados: 1,
          falhas: 1,
        });

        expect(registrador.aviso)
          .toHaveBeenCalledWith(
            expect.stringContaining(
              "aquisição financeira"
            ),
            expect.objectContaining({
              negocio_id: 70,
              evento_id: 20,
            })
          );
        expect(mockMaterializar)
          .toHaveBeenCalledTimes(2);
      }
    );

    test(
      "não sobrepõe duas execuções no mesmo processo",
      async () => {
        let liberar;
        mockListar.mockReturnValue(
          new Promise((resolve) => {
            liberar = resolve;
          })
        );

        const primeira =
          worker.executarReconciliacao();

        await Promise.resolve();

        await expect(
          worker.executarReconciliacao()
        ).resolves.toEqual({
          ignorado: true,
          motivo:
            "execucao_em_andamento",
        });

        liberar([]);
        await primeira;
      }
    );
  }
);
