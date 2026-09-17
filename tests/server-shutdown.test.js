const mockEventos = [];
let mockLiberarWebhook;

const mockParadaWebhook = jest.fn(
  () => new Promise((resolve) => {
    mockLiberarWebhook = () => {
      mockEventos.push("webhook");
      resolve();
    };
  })
);
const mockParadaWhatsapp = jest.fn(async () => {
  mockEventos.push("whatsapp");
});
const mockParadaMarketing = jest.fn(async () => {
  mockEventos.push("marketing");
});
const mockEncerrarBanco = jest.fn(async () => {
  mockEventos.push("banco");
});

jest.mock("../src/config/runtime", () => ({
  validarConfiguracaoRuntime: jest.fn(),
}));
jest.mock("../src/db/db", () => ({
  query: jest.fn(),
  end: mockEncerrarBanco,
}));
jest.mock("../src/services/webhookService", () => ({
  iniciarWorkerWebhook: jest.fn(),
  pararWorkerWebhook: mockParadaWebhook,
}));
jest.mock("../src/services/whatsappMensagemService", () => ({
  iniciarWorkerWhatsapp: jest.fn(),
  pararWorkerWhatsapp: mockParadaWhatsapp,
}));
jest.mock("../src/services/marketingCostSyncWorker", () => ({
  iniciarWorkerCustosMarketing: jest.fn(),
  pararWorkerCustosMarketing: mockParadaMarketing,
}));

const app = require("../src/server");

describe("encerramento coordenado do servidor", () => {
  test("aguarda todos os workers antes de fechar o banco", async () => {
    const encerramento = app.encerrarServidor("SIGTERM");

    await Promise.resolve();

    expect(mockParadaWebhook).toHaveBeenCalledTimes(1);
    expect(mockParadaWhatsapp).toHaveBeenCalledTimes(1);
    expect(mockParadaMarketing).toHaveBeenCalledTimes(1);
    expect(mockEncerrarBanco).not.toHaveBeenCalled();

    mockLiberarWebhook();
    await encerramento;

    expect(mockEncerrarBanco).toHaveBeenCalledTimes(1);
    expect(mockEventos.at(-1)).toBe("banco");
  });
});
