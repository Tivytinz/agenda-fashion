const mockBuscarFilas = jest.fn();

jest.mock(
  "../src/repositories/operationalMetricsRepository",
  () => ({ buscarFilas: mockBuscarFilas })
);

const metrics = require(
  "../src/services/operationalMetricsService"
);
const health = require(
  "../src/services/operationalHealthService"
);

describe("saúde operacional", () => {
  beforeEach(() => {
    metrics.limparMetricasParaTeste();
    mockBuscarFilas.mockReset();
  });

  test("registra ciclo e falhas dos workers sem expor erro ilimitado", () => {
    metrics.registrarWorkerIniciado("whatsapp");
    metrics.registrarExecucaoIniciada("whatsapp");
    metrics.registrarExecucaoFalha(
      "whatsapp",
      new Error("falha controlada")
    );

    expect(metrics.obterSnapshotWorkers()).toEqual([
      expect.objectContaining({
        nome: "whatsapp",
        ativo: true,
        emExecucao: 0,
        execucoes: 1,
        falhas: 1,
        ultimoErro: "falha controlada",
      }),
    ]);
  });

  test("combina processo, workers e atraso das filas", async () => {
    mockBuscarFilas.mockResolvedValue([
      {
        fila: "webhook_asaas",
        pendentes: 2,
        falhas: 1,
        mais_antigo_em: new Date(Date.now() - 5000),
      },
    ]);

    const resultado = await health.obterSaudeOperacional();

    expect(resultado.processo).toEqual(expect.objectContaining({
      pid: process.pid,
    }));
    expect(resultado.filas[0]).toEqual(expect.objectContaining({
      nome: "webhook_asaas",
      pendentes: 2,
      falhas: 1,
    }));
    expect(resultado.filas[0].atrasoMaisAntigoSegundos)
      .toBeGreaterThanOrEqual(4);
  });
});
