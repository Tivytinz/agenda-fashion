jest.mock(
  "../src/providers/whatsappProvider",
  () => ({
    enviarNovoAgendamento: jest.fn(),
    enviarMensagem: jest.fn(),
  })
);

const whatsappProvider = require(
  "../src/providers/whatsappProvider"
);
const notificationService = require(
  "../src/services/notificationService"
);

describe("Serviço legado de teste do WhatsApp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("envia as seis variáveis do novo agendamento na ordem aprovada", async () => {
    whatsappProvider.enviarNovoAgendamento
      .mockResolvedValue({
        messages: [{ id: "wamid.teste" }],
      });

    await notificationService.novoAgendamento({
      whatsapp: "62999999999",
      profissional: "Vanessa",
      cliente: "Maria Oliveira",
      clienteWhatsapp: "(62) 99999-9999",
      servico: "Design + Henna",
      data: "2026-08-20",
      horario: "14:00:00",
    });

    expect(
      whatsappProvider.enviarNovoAgendamento
    ).toHaveBeenCalledWith(
      "62999999999",
      [
        "Vanessa",
        "Maria Oliveira",
        "(62) 99999-9999",
        "Design + Henna",
        "20/08/2026",
        "14:00",
      ]
    );
  });
});
