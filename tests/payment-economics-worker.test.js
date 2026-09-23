const mockListar = jest.fn();
const mockReconciliar = jest.fn();

jest.mock(
  "../src/repositories/paymentEconomicsRepository",
  () => ({
    listarPendentes: mockListar,
  })
);

jest.mock(
  "../src/services/paymentEconomicsService",
  () => ({
    reconciliarPagamento:
      mockReconciliar,
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
  "../src/services/paymentEconomicsReconciliationWorker"
);

describe(
  "paymentEconomicsReconciliationWorker",
  () => {
    const envOriginal = process.env;

    beforeEach(async () => {
      jest.clearAllMocks();
      process.env = {
        ...envOriginal,
        PAYMENT_ECONOMICS_RECONCILIATION_INTERVAL_MS:
          "60000",
        PAYMENT_ECONOMICS_RECONCILIATION_BATCH_SIZE:
          "25",
      };
      await worker
        .pararWorkerPaymentEconomics();
    });

    afterEach(async () => {
      await worker
        .pararWorkerPaymentEconomics();
      process.env = envOriginal;
    });

    test("reconcilia lote e distingue resposta obsoleta", async () => {
      mockListar.mockResolvedValue([
        {
          pagamento_id: 1,
          asaas_payment_id: "pay_1",
        },
        {
          pagamento_id: 2,
          asaas_payment_id: "pay_2",
        },
      ]);
      mockReconciliar
        .mockResolvedValueOnce({
          pagamento_id: 1,
        })
        .mockResolvedValueOnce({
          obsoleto: true,
          pagamento_id: 2,
        });

      await expect(
        worker.executarReconciliacao()
      ).resolves.toMatchObject({
        candidatos: 2,
        reconciliados: 1,
        obsoletos: 1,
        falhas: 0,
      });

      expect(mockListar)
        .toHaveBeenCalledWith(25);
    });

    test("isola falha de uma cobrança e continua o lote", async () => {
      mockListar.mockResolvedValue([
        { pagamento_id: 1 },
        { pagamento_id: 2 },
      ]);
      mockReconciliar
        .mockRejectedValueOnce(
          new Error("timeout")
        )
        .mockResolvedValueOnce({
          pagamento_id: 2,
        });

      await expect(
        worker.executarReconciliacao()
      ).resolves.toMatchObject({
        reconciliados: 1,
        falhas: 1,
      });

      expect(mockReconciliar)
        .toHaveBeenCalledTimes(2);
    });

    test("não sobrepõe duas execuções no mesmo processo", async () => {
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
    });
  }
);
