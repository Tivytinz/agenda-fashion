const mockWebhookRepository = {
  marcarProcessamentosEsgotados: jest.fn(),
  reservarProximo: jest.fn(),
};

jest.mock(
  "../src/repositories/webhookEventoRepository",
  () => mockWebhookRepository
);
jest.mock(
  "../src/services/marketingConversionDeliveryService",
  () => ({
    processarFilaConversoes: jest.fn().mockResolvedValue(0),
  })
);
jest.mock("../src/services/assinaturaService", () => ({
  ativarAssinaturaPorPagamento: jest.fn(),
  sincronizarAssinaturaPorWebhook: jest.fn(),
  sincronizarPagamentoPorWebhook: jest.fn(),
  suspenderAssinaturaPorPagamento: jest.fn(),
}));

const webhookService = require(
  "../src/services/webhookService"
);

describe("encerramento do worker de webhooks", () => {
  afterEach(async () => {
    await webhookService.pararWorkerWebhook();
    jest.clearAllMocks();
  });

  test("aguarda o ciclo em andamento antes de concluir", async () => {
    let liberarVarredura;
    const varreduraPendente = new Promise((resolve) => {
      liberarVarredura = resolve;
    });

    mockWebhookRepository
      .marcarProcessamentosEsgotados
      .mockReturnValue(varreduraPendente);
    mockWebhookRepository.reservarProximo
      .mockResolvedValue(null);

    webhookService.iniciarWorkerWebhook();
    await new Promise((resolve) => setImmediate(resolve));

    let encerrado = false;
    const encerramento = webhookService
      .pararWorkerWebhook()
      .then(() => {
        encerrado = true;
      });

    await Promise.resolve();
    expect(encerrado).toBe(false);

    liberarVarredura();
    await encerramento;

    expect(encerrado).toBe(true);
  });
});
