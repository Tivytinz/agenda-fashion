jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);

describe(
  "Repository da fila de webhooks",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "persiste um evento novo como pendente",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PENDING",
              tentativas: 0
            }
          ]
        });

        const resultado =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId: "evt_1",
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId: "pay_1",
              payload: {
                id: "evt_1"
              }
            });

        expect(resultado.novo)
          .toBe(true);
        expect(resultado.evento.status)
          .toBe("PENDING");
        expect(db.query)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      "recupera o registro de uma entrega duplicada",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                status: "PROCESSED"
              }
            ]
          });

        const resultado =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId: "evt_1",
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId: "pay_1",
              payload: {}
            });

        expect(resultado.novo)
          .toBe(false);
        expect(resultado.evento.status)
          .toBe("PROCESSED");
      }
    );

    test(
      "reserva um evento sem permitir processamento concorrente",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PROCESSING",
              tentativas: 1
            }
          ]
        });

        const evento =
          await webhookEventoRepository
            .reservarProximo();

        expect(evento.status)
          .toBe("PROCESSING");
        expect(
          db.query.mock.calls[0][0]
        ).toContain(
          "FOR UPDATE SKIP LOCKED"
        );
      }
    );

    test(
      "agenda nova tentativa ao registrar falha",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "FAILED"
            }
          ]
        });

        await webhookEventoRepository
          .marcarFalha(
            1,
            "erro temporário"
          );

        expect(
          db.query.mock.calls[0][0]
        ).toContain(
          "proxima_tentativa_em"
        );
      }
    );
  }
);
