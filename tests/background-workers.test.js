const mockIniciarWorkerWebhook = jest.fn();
const mockPararWorkerWebhook = jest.fn(async () => {});
const mockIniciarWorkerWhatsapp = jest.fn();
const mockPararWorkerWhatsapp = jest.fn(async () => {});
const mockIniciarWorkerCustosMarketing = jest.fn();
const mockPararWorkerCustosMarketing = jest.fn(async () => {});

jest.mock("../src/services/webhookService", () => ({
  iniciarWorkerWebhook: mockIniciarWorkerWebhook,
  pararWorkerWebhook: mockPararWorkerWebhook,
}));
jest.mock("../src/services/whatsappMensagemService", () => ({
  iniciarWorkerWhatsapp: mockIniciarWorkerWhatsapp,
  pararWorkerWhatsapp: mockPararWorkerWhatsapp,
}));
jest.mock("../src/services/marketingCostSyncWorker", () => ({
  iniciarWorkerCustosMarketing: mockIniciarWorkerCustosMarketing,
  pararWorkerCustosMarketing: mockPararWorkerCustosMarketing,
}));

const workers = require("../src/workers/backgroundWorkers");

describe("orquestração dos workers", () => {
  test("inicia e encerra todos os processadores", async () => {
    workers.iniciarWorkers();
    expect(mockIniciarWorkerWebhook).toHaveBeenCalledTimes(1);
    expect(mockIniciarWorkerWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockIniciarWorkerCustosMarketing).toHaveBeenCalledTimes(1);

    const resultados = await workers.pararWorkers();
    expect(resultados).toHaveLength(3);
    expect(mockPararWorkerWebhook).toHaveBeenCalledTimes(1);
    expect(mockPararWorkerWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockPararWorkerCustosMarketing).toHaveBeenCalledTimes(1);
  });
});
