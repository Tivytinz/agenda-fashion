const mockColetar = jest.fn();
const mockMetricas = {
  registrarWorkerIniciado: jest.fn(),
  registrarWorkerParado: jest.fn(),
  registrarExecucaoIniciada: jest.fn(),
  registrarExecucaoConcluida: jest.fn(),
  registrarExecucaoFalha: jest.fn(),
};

jest.mock("../src/services/mlNoShowDataService", () => ({
  coletar: mockColetar,
}));
jest.mock(
  "../src/services/operationalMetricsService",
  () => mockMetricas
);

const worker = require(
  "../src/services/mlNoShowDataWorker"
);

describe("worker de dados de ML para no-show", () => {
  const envOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...envOriginal,
      ML_NO_SHOW_DATA_ENABLED: "true",
      ML_NO_SHOW_DATA_BATCH_SIZE: "25",
      ML_NO_SHOW_DATA_INTERVAL_MS: "60000",
    };
  });

  afterEach(async () => {
    await worker.pararWorkerMlNoShow();
    process.env = envOriginal;
  });

  test("executa coleta agregada e registra sucesso operacional", async () => {
    mockColetar.mockResolvedValue({
      amostras_capturadas: 25,
      amostras_rotuladas_nesta_execucao: 3,
      prontidao: {
        pronta_para_treinamento: false,
        dados: {
          amostras_rotuladas: 80,
        },
      },
    });

    await expect(worker.executarColeta()).resolves.toMatchObject({
      ignorado: false,
      amostras_capturadas: 25,
    });

    expect(mockColetar).toHaveBeenCalledWith({ limite: 25 });
    expect(
      mockMetricas.registrarExecucaoConcluida
    ).toHaveBeenCalledWith("ml_no_show_dados");
    expect(
      mockMetricas.registrarExecucaoFalha
    ).not.toHaveBeenCalled();
  });

  test("registra falha sem esconder o erro do ciclo", async () => {
    const erro = new Error("banco indisponível");
    mockColetar.mockRejectedValue(erro);

    await expect(worker.executarColeta()).rejects.toThrow(
      "banco indisponível"
    );

    expect(
      mockMetricas.registrarExecucaoFalha
    ).toHaveBeenCalledWith("ml_no_show_dados", erro);
  });

  test("permanece desligado sem a flag explícita", async () => {
    process.env.ML_NO_SHOW_DATA_ENABLED = "false";

    expect(worker.iniciarWorkerMlNoShow()).toBe(false);
    expect(
      mockMetricas.registrarWorkerParado
    ).toHaveBeenCalledWith("ml_no_show_dados");
  });
});
