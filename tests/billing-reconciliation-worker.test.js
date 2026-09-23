const mockListar = jest.fn();
const mockListarInadimplentes = jest.fn();
const mockExpirar = jest.fn();
const mockReconciliarInadimplencia = jest.fn();
const mockMetricas = {
  registrarWorkerIniciado: jest.fn(),
  registrarWorkerParado: jest.fn(),
  registrarExecucaoIniciada: jest.fn(),
  registrarExecucaoConcluida: jest.fn(),
  registrarExecucaoFalha: jest.fn(),
};

jest.mock(
  "../src/repositories/assinaturaRepository",
  () => ({
    listarNegociosComCancelamentoExpirado:
      mockListar,
    listarPagamentosInadimplentesMaduros:
      mockListarInadimplentes,
  })
);
jest.mock("../src/services/planoService", () => ({
  expirarCancelamentoComReconciliacao:
    mockExpirar,
}));
jest.mock("../src/services/assinaturaInadimplenciaService", () => ({
  reconciliarInadimplenciaTerminal:
    mockReconciliarInadimplencia,
}));
jest.mock(
  "../src/services/operationalMetricsService",
  () => mockMetricas
);

const worker = require(
  "../src/services/billingReconciliationWorker"
);

describe("worker de reconciliação financeira", () => {
  const envOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...envOriginal,
      BILLING_RECONCILIATION_BATCH_SIZE: "25",
      BILLING_RECONCILIATION_INTERVAL_MS: "60000",
      BILLING_DELINQUENCY_TERMINAL_DAYS: "14",
    };
    mockListarInadimplentes.mockResolvedValue([]);
    mockReconciliarInadimplencia.mockResolvedValue(null);
  });

  afterEach(async () => {
    await worker.pararWorkerBillingReconciliation();
    process.env = envOriginal;
  });

  test("reconcilia cancelamentos vencidos sem depender de navegação", async () => {
    mockListar.mockResolvedValue([
      { negocio_id: 7 },
      { negocio_id: 8 },
    ]);
    mockExpirar
      .mockResolvedValueOnce({
        id: 20,
        negocio_id: 7,
      })
      .mockResolvedValueOnce(null);

    await expect(
      worker.executarReconciliacao()
    ).resolves.toEqual({
      ignorado: false,
      candidatos: 2,
      cancelamentosReconciliados: 1,
      inadimplenciasTerminalizadas: 0,
      reconciliados: 1,
      falhas: 0,
    });

    expect(mockListar).toHaveBeenCalledWith(25);
    expect(mockExpirar).toHaveBeenNthCalledWith(
      1,
      7
    );
    expect(mockExpirar).toHaveBeenNthCalledWith(
      2,
      8
    );
    expect(
      mockMetricas.registrarExecucaoConcluida
    ).toHaveBeenCalledWith(
      "billing_reconciliation"
    );
  });

  test("materializa inadimplência madura no mesmo worker", async () => {
    mockListar.mockResolvedValue([]);
    mockListarInadimplentes.mockResolvedValue([
      { pagamento_id: 80, negocio_id: 7 },
    ]);
    mockReconciliarInadimplencia
      .mockResolvedValue({
        tipo: "ACESSO_PAGO_ENCERRADO",
      });

    await expect(
      worker.executarReconciliacao()
    ).resolves.toMatchObject({
      candidatos: 1,
      cancelamentosReconciliados: 0,
      inadimplenciasTerminalizadas: 1,
      reconciliados: 1,
      falhas: 0,
    });

    expect(
      mockListarInadimplentes
    ).toHaveBeenCalledWith(25, 14);
    expect(
      mockReconciliarInadimplencia
    ).toHaveBeenCalledWith({
      pagamentoId: 80,
      janelaDias: 14,
    });
  });

  test("isola falha de um negócio e continua o lote", async () => {
    mockListar.mockResolvedValue([
      { negocio_id: 7 },
      { negocio_id: 8 },
    ]);
    mockExpirar
      .mockRejectedValueOnce(
        new Error("falha transitória")
      )
      .mockResolvedValueOnce({
        id: 21,
        negocio_id: 8,
      });

    await expect(
      worker.executarReconciliacao()
    ).resolves.toMatchObject({
      ignorado: false,
      candidatos: 2,
      cancelamentosReconciliados: 1,
      inadimplenciasTerminalizadas: 0,
      reconciliados: 1,
      falhas: 1,
    });

    expect(mockExpirar).toHaveBeenCalledTimes(2);
    expect(
      mockMetricas.registrarExecucaoFalha
    ).toHaveBeenCalledWith(
      "billing_reconciliation",
      expect.any(Error)
    );
  });
});
