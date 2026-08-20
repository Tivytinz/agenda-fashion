jest.mock(
  "../src/db/db",
  () => ({
    executarTransacao:
      jest.fn(),
  })
);

jest.mock(
  "../src/repositories/agendaPublicaRepository"
);

jest.mock(
  "../src/repositories/agendaConfiguracaoRepository"
);

jest.mock(
  "../src/services/agendaDisponibilidadeService",
  () => ({})
);

jest.mock(
  "../src/services/planoService",
  () => ({})
);

jest.mock(
  "../src/services/whatsappMensagemService",
  () => ({
    enfileirarNovoAgendamento:
      jest.fn(),
    enfileirarCancelamento:
      jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);

const agendaConfiguracaoRepository = require(
  "../src/repositories/agendaConfiguracaoRepository"
);

const whatsappMensagemService = require(
  "../src/services/whatsappMensagemService"
);

const agendamentoPublicoService = require(
  "../src/services/agendamentoPublicoService"
);

function obterDataAmanhaBrasil() {
  const data =
    new Date(
      Date.now() +
      36 * 60 * 60 * 1000
    );

  const partes =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Sao_Paulo",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      data
    );

  const parte =
    (tipo) =>
      partes.find(
        (item) =>
          item.type === tipo
      )?.value;

  return (
    `${parte("year")}-` +
    `${parte("month")}-` +
    parte("day")
  );
}

describe(
  "Consentimento das mensagens da cliente",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "usa a escolha do formulário para visitante",
      async () => {
        await expect(
          agendamentoPublicoService
            .resolverConsentimentoWhatsapp({
              clienteId: null,
              consentimentoVisitante: true,
            })
        ).resolves.toBe(true);

        expect(
          agendaPublicaRepository
            .buscarPreferenciaNotificacoesWhatsapp
        ).not.toHaveBeenCalled();
      }
    );

    test(
      "usa a preferência da conta para cliente autenticada",
      async () => {
        agendaPublicaRepository
          .buscarPreferenciaNotificacoesWhatsapp
          .mockResolvedValue({
            aceita_notificacoes_whatsapp: false,
          });

        await expect(
          agendamentoPublicoService
            .resolverConsentimentoWhatsapp({
              clienteId: 8,
              consentimentoVisitante: true,
            })
        ).resolves.toBe(false);

        expect(
          agendaPublicaRepository
            .buscarPreferenciaNotificacoesWhatsapp
        ).toHaveBeenCalledWith(8);
      }
    );
  }
);

describe(
  "Mensagens ligadas ao cancelamento",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "cancela e enfileira avisos na mesma transação",
      async () => {
        const client = {
          query: jest.fn(),
        };

        const agendamento = {
          id: 50,
          profissional_id: 7,
          cliente_id: 8,
          data:
            obterDataAmanhaBrasil(),
          horario:
            "23:00",
          status:
            "agendado",
        };

        agendaPublicaRepository
          .buscarAgendamentoCliente
          .mockResolvedValue(
            agendamento
          );

        agendaConfiguracaoRepository
          .buscarConfiguracao
          .mockResolvedValue({
            antecedencia_cancelamento:
              0,
          });

        agendaPublicaRepository
          .cancelarAgendamento
          .mockResolvedValue({
            id: 50,
            status:
              "cancelado",
          });

        db.executarTransacao
          .mockImplementation(
            async (
              callback
            ) =>
              callback(
                client
              )
          );

        const resultado =
          await agendamentoPublicoService
            .cancelarMeuAgendamento({
              clienteId: 8,
              agendamentoId: 50,
            });

        expect(
          agendaPublicaRepository
            .cancelarAgendamento
        ).toHaveBeenCalledWith(
          50,
          8,
          client
        );

        expect(
          whatsappMensagemService
            .enfileirarCancelamento
        ).toHaveBeenCalledWith({
          executor:
            client,
          agendamentoId:
            50,
        });

        expect(resultado).toEqual({
          mensagem:
            "Agendamento cancelado com sucesso.",
        });
      }
    );
  }
);
