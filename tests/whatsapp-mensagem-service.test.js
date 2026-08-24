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
    registrarStatusEntrega:
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

      delete process.env
        .WHATSAPP_PROFESSIONAL_REMINDER_ENABLED;
      delete process.env
        .WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED;
      delete process.env
        .WHATSAPP_SHARE_REMINDER_ENABLED;

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

        process.env
          .WHATSAPP_PROFESSIONAL_REMINDER_ENABLED =
          "true";

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
          12,
          true
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
      "enfileira no máximo um lembrete diário elegível por negócio",
      async () => {
        process.env
          .WHATSAPP_FIRST_SERVICE_REMINDER_ENABLED =
          "true";
        process.env
          .WHATSAPP_SHARE_REMINDER_ENABLED =
          "true";
        process.env
          .WHATSAPP_BUSINESS_REMINDER_HOUR =
          "10";

        whatsappMensagemRepository
          .enfileirarLembretesDiariosNegocios
          .mockResolvedValue([]);
        whatsappMensagemRepository
          .reservarProximaMensagem
          .mockResolvedValue(null);

        await whatsappMensagemService
          .processarFilaWhatsapp({
            limite: 5,
          });

        expect(
          whatsappMensagemRepository
            .enfileirarLembretesDiariosNegocios
        ).toHaveBeenCalledWith(
          10,
          true,
          true,
          3,
          3
        );
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
          120,
          true
        );
      }
    );

    test(
      "não repete erro permanente de template",
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

        const erro =
          new Error(
            "Template inexistente."
          );

        erro.response = {
          status: 400,
          data: {
            error: {
              code: 132001,
              message:
                "Template inexistente.",
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
          "HTTP 400 - código 132001 - Template inexistente.",
          60,
          false
        );
      }
    );

    test.each([
      [408, true],
      [429, true],
      [500, true],
      [503, true],
      [400, false],
      [401, false],
    ])(
      "classifica HTTP %i como retentável=%s",
      (
        status,
        esperado
      ) => {
        expect(
          whatsappMensagemService
            .erroEhRetentavel({
              response: {
                status,
              },
            })
        ).toBe(esperado);
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
      "usa os nomes configurados dos templates operacionais e diários",
      () => {
        const nomesEsperados = {
          NOVO_AGENDAMENTO_PROFISSIONAL:
            "novo_agendamento",
          CONFIRMACAO_AGENDAMENTO_CLIENTE:
            "confirmacao_agendamento_cliente",
          LEMBRETE_AGENDAMENTO_CLIENTE:
            "lembrete_agendamento",
          LEMBRETE_AGENDAMENTO_PROFISSIONAL:
            "lembrete_agendamento_profissional",
          CANCELAMENTO_AGENDAMENTO_PROFISSIONAL:
            "cancelamento_agendamento_profissional",
          CANCELAMENTO_AGENDAMENTO_CLIENTE:
            "cancelamento_agendamento",
          LEMBRETE_PRIMEIRO_SERVICO_NEGOCIO:
            "lembrete_primeiro_servico",
          LEMBRETE_DIVULGAR_NEGOCIO:
            "lembrete_divulgar_negocio",
        };

        for (const nomeVariavel of [
          "WHATSAPP_TEMPLATE_NOVO_AGENDAMENTO",
          "WHATSAPP_TEMPLATE_CONFIRMACAO_CLIENTE",
          "WHATSAPP_TEMPLATE_LEMBRETE_CLIENTE",
          "WHATSAPP_TEMPLATE_LEMBRETE_PROFISSIONAL",
          "WHATSAPP_TEMPLATE_CANCELAMENTO_PROFISSIONAL",
          "WHATSAPP_TEMPLATE_CANCELAMENTO_CLIENTE",
          "WHATSAPP_TEMPLATE_PRIMEIRO_SERVICO",
          "WHATSAPP_TEMPLATE_DIVULGAR_NEGOCIO",
        ]) {
          delete process.env[nomeVariavel];
        }

        for (const [tipo, nome] of Object.entries(nomesEsperados)) {
          expect(
            whatsappMensagemService.obterNomeTemplate(tipo)
          ).toBe(nome);
        }
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

    test(
      "impede ativação sem os segredos do webhook",
      () => {
        delete process.env
          .WHATSAPP_APP_SECRET;

        delete process.env
          .WHATSAPP_WEBHOOK_VERIFY_TOKEN;

        expect(
          () =>
            whatsappMensagemService
              .validarConfiguracaoAtivacao()
        ).toThrow(
          "WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado"
        );
      }
    );
  }
);
