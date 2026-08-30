jest.mock(
  "../src/repositories/whatsappMensagemRepository",
  () => ({
    enfileirarNovoAgendamento:
      jest.fn(),
    enfileirarCancelamento:
      jest.fn(),
    enfileirarLembretesDiariosNegocios:
      jest.fn(),
    reservarProximaMensagem:
      jest.fn(),
    mensagemContinuaValida:
      jest.fn(),
    cancelarMensagensExpiradas:
      jest.fn(),
    marcarEnviada:
      jest.fn(),
    marcarFalha:
      jest.fn(),
    marcarCancelada:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/whatsappAgendaRepository",
  () => ({
    negocioTemAgendaConfigurada:
      jest.fn(),
  })
);

jest.mock(
  "../src/providers/whatsappProvider",
  () => ({
    enviarTemplate:
      jest.fn(),
    validarConfiguracao:
      jest.fn(),
  })
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);
const whatsappAgendaRepository = require(
  "../src/repositories/whatsappAgendaRepository"
);
const whatsappProvider = require(
  "../src/providers/whatsappProvider"
);
const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);

function criarLembreteDivulgacao() {
  return {
    id: 81,
    agendamento_id: null,
    negocio_id: 42,
    tipo:
      "LEMBRETE_DIVULGAR_NEGOCIO",
    destinatario:
      "62999999999",
    parametros_corpo: [
      "Ana",
      "Studio Ana",
      "https://app.agendafashion.com.br/negocio/studio-ana",
    ],
    tentativas: 1,
    max_tentativas: 5,
  };
}

describe(
  "Revalidação de divulgação no WhatsApp",
  () => {
    beforeEach(() => {
      jest.resetAllMocks();

      delete process.env
        .WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED;
      delete process.env
        .WHATSAPP_SHARE_REMINDER_ENABLED;

      whatsappMensagemRepository
        .cancelarMensagensExpiradas
        .mockResolvedValue(0);

      whatsappMensagemRepository
        .mensagemContinuaValida
        .mockResolvedValue(true);

      whatsappAgendaRepository
        .negocioTemAgendaConfigurada
        .mockResolvedValue(true);
    });

    test(
      "cancela a divulgação se a agenda deixou de estar configurada antes do envio",
      async () => {
        const mensagem =
          criarLembreteDivulgacao();

        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValue(
            mensagem
          );

        whatsappAgendaRepository
          .negocioTemAgendaConfigurada
          .mockResolvedValue(false);

        const resultado =
          await whatsappMensagemService
            .processarFilaWhatsapp({
              limite: 1,
            });

        expect(
          whatsappAgendaRepository
            .negocioTemAgendaConfigurada
        ).toHaveBeenCalledWith(42);

        expect(
          whatsappProvider
            .enviarTemplate
        ).not.toHaveBeenCalled();

        expect(
          whatsappMensagemRepository
            .marcarCancelada
        ).toHaveBeenCalledWith(
          81,
          "O estado atual do negócio não permite a divulgação."
        );

        expect(resultado).toEqual({
          ignorado: false,
          processadas: 1,
        });
      }
    );

    test(
      "mantém a divulgação quando a agenda continua configurada",
      async () => {
        const mensagem =
          criarLembreteDivulgacao();

        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValue(
            mensagem
          );

        whatsappProvider
          .enviarTemplate
          .mockResolvedValue({
            messages: [
              {
                id:
                  "wamid.divulgacao",
              },
            ],
          });

        await whatsappMensagemService
          .processarFilaWhatsapp({
            limite: 1,
          });

        expect(
          whatsappAgendaRepository
            .negocioTemAgendaConfigurada
        ).toHaveBeenCalledWith(42);

        expect(
          whatsappProvider
            .enviarTemplate
        ).toHaveBeenCalledWith({
          numero:
            "62999999999",
          nomeTemplate:
            "lembrete_divulgar_negocio",
          codigoIdioma:
            "pt_BR",
          parametrosCorpo:
            mensagem.parametros_corpo,
        });

        expect(
          whatsappMensagemRepository
            .marcarEnviada
        ).toHaveBeenCalledWith(
          81,
          "wamid.divulgacao"
        );
      }
    );
  }
);
