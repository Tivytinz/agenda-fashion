const mockRepository = {
  cancelarMensagensExpiradas: jest.fn(),
  reservarProximaMensagem: jest.fn(),
};

jest.mock(
  "../src/repositories/whatsappMensagemRepository",
  () => mockRepository
);
jest.mock(
  "../src/repositories/whatsappAgendaRepository",
  () => ({
    negocioTemAgendaConfigurada: jest.fn(),
  })
);
jest.mock("../src/providers/whatsappProvider", () => ({
  validarConfiguracao: jest.fn(),
  enviarTemplate: jest.fn(),
}));

const worker = require(
  "../src/services/whatsappMensagemService"
);

describe("encerramento do worker do WhatsApp", () => {
  const ambienteOriginal = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ambienteOriginal,
      NODE_ENV: "development",
      WHATSAPP_NOTIFICATIONS_ENABLED: "true",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "verify",
      WHATSAPP_APP_SECRET: "secret",
    };
    mockRepository.reservarProximaMensagem
      .mockResolvedValue(null);
  });

  afterEach(async () => {
    await worker.pararWorkerWhatsapp();
    process.env = ambienteOriginal;
  });

  test("aguarda a varredura em andamento antes de concluir", async () => {
    let liberarVarredura;
    const varreduraPendente = new Promise((resolve) => {
      liberarVarredura = resolve;
    });
    mockRepository.cancelarMensagensExpiradas
      .mockReturnValue(varreduraPendente);

    worker.iniciarWorkerWhatsapp();
    await Promise.resolve();

    let encerrado = false;
    const encerramento = worker.pararWorkerWhatsapp()
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
