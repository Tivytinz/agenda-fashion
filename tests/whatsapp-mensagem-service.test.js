jest.mock(
  "../src/repositories/whatsappMensagemRepository",
  () => ({
    enfileirarNovoAgendamento:
      jest.fn(),
    enfileirarCancelamento:
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
  "../src/providers/whatsappProvider",
  () => ({
    enviarTemplate:
      jest.fn(),
  })
);

const whatsappMensagemRepository = require(
  "../src/repositories/whatsappMensagemRepository"
);

const whatsappProvider = require(
  "../src/providers/whatsappProvider"
);

const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);

function criarMensagem(
  sobrescritas = {}
) {
  return {
    id: 10,
    agendamento_id: 20,
    tipo:
      "CONFIRMACAO_AGENDAMENTO_CLIENTE",
    destinatario:
      "62999999999",
    parametros_corpo: [
      "Ana",
      "Studio",
      "Manicure",
      "Bia",
      "30/07/2026",
      "14:00",
    ],
    tentativas: 1,
    max_tentativas: 5,
    ...sobrescritas,
  };
}

describe(
  "Fila automática do WhatsApp",
  () => {
    const ambienteOriginal = {
      ...process.env,
    };

    beforeEach(() => {
      jest.resetAllMocks();

      process.env
        .WHATSAPP_TEMPLATE_LANGUAGE =
        "pt_BR";

      whatsappMensagemRepository
        .cancelarMensagensExpiradas
        .mockResolvedValue(0);
    });

    afterAll(() => {
      process.env = {
        ...ambienteOriginal,
      };
    });

    test(
      "enfileira mensagens e lembrete na mesma transação",
      async () => {
        const executor = {
          query: jest.fn(),
        };

        process.env
          .WHATSAPP_REMINDER_HOURS =
          "12";

        whatsappMensagemRepository
          .enfileirarNovoAgendamento
          .mockResolvedValue([
            {
              id: 1,
            },
          ]);

        await whatsappMensagemService
          .enfileirarNovoAgendamento({
            executor,
            agendamentoId: 99,
          });

        expect(
          whatsappMensagemRepository
            .enfileirarNovoAgendamento
        ).toHaveBeenCalledWith(
          executor,
          99,
          12
        );
      }
    );

    test(
      "envia template e registra o ID aceito pela Meta",
      async () => {
        const mensagem =
          criarMensagem();

        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValueOnce(
            mensagem
          )
          .mockResolvedValueOnce(
            null
          );

        whatsappMensagemRepository
          .mensagemContinuaValida
          .mockResolvedValue(
            true
          );

        whatsappProvider
          .enviarTemplate
          .mockResolvedValue({
            messages: [
              {
                id:
                  "wamid.teste",
              },
            ],
          });

        const resultado =
          await whatsappMensagemService
            .processarFilaWhatsapp({
              limite: 5,
            });

        expect(
          whatsappProvider
            .enviarTemplate
        ).toHaveBeenCalledWith({
          numero:
            "62999999999",
          nomeTemplate:
            "confirmacao_agendamento_cliente",
          codigoIdioma:
            "pt_BR",
          parametrosCorpo:
            mensagem.parametros_corpo,
        });

        expect(
          whatsappMensagemRepository
            .marcarEnviada
        ).toHaveBeenCalledWith(
          10,
          "wamid.teste"
        );

        expect(resultado).toEqual({
          ignorado: false,
          processadas: 1,
        });
      }
    );

    test(
      "registra falha sem expor token e agenda nova tentativa",
      async () => {
        const mensagem =
          criarMensagem({
            tentativas: 2,
          });

        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValueOnce(
            mensagem
          )
          .mockResolvedValueOnce(
            null
          );

        whatsappMensagemRepository
          .mensagemContinuaValida
          .mockResolvedValue(
            true
          );

        const erro =
          new Error(
            "Bearer token-super-secreto recusado"
          );

        erro.response = {
          status: 429,
          data: {
            error: {
              code: 130429,
              message:
                "Limite temporário atingido.",
            },
          },
        };

        whatsappProvider
          .enviarTemplate
          .mockRejectedValue(
            erro
          );

        await whatsappMensagemService
          .processarFilaWhatsapp({
            limite: 1,
          });

        expect(
          whatsappMensagemRepository
            .marcarFalha
        ).toHaveBeenCalledWith(
          mensagem,
          "HTTP 429 - código 130429 - Limite temporário atingido.",
          120
        );
      }
    );

    test(
      "cancela mensagem quando o agendamento mudou de estado",
      async () => {
        const mensagem =
          criarMensagem();

        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValueOnce(
            mensagem
          )
          .mockResolvedValueOnce(
            null
          );

        whatsappMensagemRepository
          .mensagemContinuaValida
          .mockResolvedValue(
            false
          );

        await whatsappMensagemService
          .processarFilaWhatsapp({
            limite: 5,
          });

        expect(
          whatsappProvider
            .enviarTemplate
        ).not.toHaveBeenCalled();

        expect(
          whatsappMensagemRepository
            .marcarCancelada
        ).toHaveBeenCalledWith(
          10,
          "O estado atual do agendamento não permite o envio."
        );
      }
    );

    test(
      "rejeita um tipo sem template configurado",
      () => {
        expect(
          () =>
            whatsappMensagemService
              .obterNomeTemplate(
                "TIPO_INEXISTENTE"
              )
        ).toThrow(
          "Tipo de mensagem do WhatsApp não suportado"
        );
      }
    );
  }
);
