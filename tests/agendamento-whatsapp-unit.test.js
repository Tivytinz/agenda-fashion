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
  "../src/repositories/agendamentoCancelamentoRepository",
  () => ({
    buscarAgendamentoClienteParaCancelar:
      jest.fn(),
    cancelarAgendamentoCliente:
      jest.fn(),
  })
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
  "../src/services/bookingAnalyticsService",
  () => ({
    registrarBookingCancelled:
      jest.fn(),
  })
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

const agendamentoCancelamentoRepository =
  require(
    "../src/repositories/agendamentoCancelamentoRepository"
  );

const bookingAnalyticsService =
  require(
    "../src/services/bookingAnalyticsService"
  );

const whatsappMensagemService =
  require(
    "../src/services/whatsappMensagemService"
  );

const agendamentoPublicoService =
  require(
    "../src/services/agendamentoPublicoService"
  );

const agendamentoCancelamentoService =
  require(
    "../src/services/agendamentoCancelamentoService"
  );

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
              clienteWhatsapp:
                "62999998888",
              consentimentoVisitante:
                true,
            })
        ).resolves.toBe(
          true
        );

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
            whatsapp:
              "62999998888",
            aceita_notificacoes_whatsapp:
              false,
          });

        await expect(
          agendamentoPublicoService
            .resolverConsentimentoWhatsapp({
              clienteId: 8,
              clienteWhatsapp:
                "62999998888",
              consentimentoVisitante:
                true,
            })
        ).resolves.toBe(
          false
        );

        expect(
          agendaPublicaRepository
            .buscarPreferenciaNotificacoesWhatsapp
        ).toHaveBeenCalledWith(
          8
        );
      }
    );

    test(
      "autoriza somente o mesmo número registrado na conta",
      async () => {
        agendaPublicaRepository
          .buscarPreferenciaNotificacoesWhatsapp
          .mockResolvedValue({
            whatsapp:
              "62999998888",
            aceita_notificacoes_whatsapp:
              true,
          });

        await expect(
          agendamentoPublicoService
            .resolverConsentimentoWhatsapp({
              clienteId: 8,
              clienteWhatsapp:
                "+55 (62) 99999-8888",
              consentimentoVisitante:
                false,
            })
        ).resolves.toBe(
          true
        );

        await expect(
          agendamentoPublicoService
            .resolverConsentimentoWhatsapp({
              clienteId: 8,
              clienteWhatsapp:
                "62911112222",
              consentimentoVisitante:
                true,
            })
        ).resolves.toBe(
          false
        );
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
      "cancela e enfileira avisos na mesma transação pelo fluxo canônico",
      async () => {
        const client = {
          query:
            jest.fn(),
        };

        const agendamento = {
          id: 50,
          profissional_id: 7,
          negocio_id: 11,
          cliente_id: 8,
          inicio_previsto_em:
            new Date(
              Date.now() +
                36 *
                  60 *
                  60 *
                  1000
            ).toISOString(),
          antecedencia_cancelamento_horas:
            0,
          status:
            "agendado",
        };

        agendamentoCancelamentoRepository
          .buscarAgendamentoClienteParaCancelar
          .mockResolvedValue(
            agendamento
          );

        agendamentoCancelamentoRepository
          .cancelarAgendamentoCliente
          .mockResolvedValue({
            id: 50,
            status:
              "cancelado",
          });

        bookingAnalyticsService
          .registrarBookingCancelled
          .mockResolvedValue(
            undefined
          );

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
          await agendamentoCancelamentoService
            .cancelarAgendamentoCliente({
              clienteId: 8,
              agendamentoId: 50,
            });

        expect(
          agendamentoCancelamentoRepository
            .buscarAgendamentoClienteParaCancelar
        ).toHaveBeenCalledWith({
          agendamentoId: 50,
          clienteId: 8,
          executor:
            client,
        });

        expect(
          agendamentoCancelamentoRepository
            .cancelarAgendamentoCliente
        ).toHaveBeenCalledWith({
          agendamentoId: 50,
          clienteId: 8,
          executor:
            client,
        });

        expect(
          whatsappMensagemService
            .enfileirarCancelamento
        ).toHaveBeenCalledWith({
          executor:
            client,
          agendamentoId:
            50,
        });

        expect(
          resultado
        ).toEqual({
          id: 50,
          status:
            "cancelado",
        });
      }
    );
  }
);
