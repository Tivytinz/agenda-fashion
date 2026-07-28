jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);

describe(
  "Repository de eventos do webhook",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "assume o processamento de um evento novo",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status:
                "PROCESSING",
              tentativas: 1,
            },
          ],
        });

        const resultado =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId: "evt_1",
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId: "pay_1",
            });

        expect(resultado).toEqual(
          expect.objectContaining({
            processar: true,
            novo: true,
          })
        );

        expect(db.query)
          .toHaveBeenCalledTimes(1);
      }
    );

    test(
      "retoma um evento que falhou",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                status:
                  "PROCESSING",
                tentativas: 2,
              },
            ],
          });

        const resultado =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId: "evt_1",
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId: "pay_1",
            });

        expect(resultado).toEqual(
          expect.objectContaining({
            processar: true,
            novo: false,
          })
        );

        expect(db.query)
          .toHaveBeenCalledTimes(2);
      }
    );

    test(
      "apenas contabiliza uma entrega já concluída",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [],
          })
          .mockResolvedValueOnce({
            rows: [],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                status:
                  "PROCESSED",
                tentativas: 2,
              },
            ],
          });

        const resultado =
          await webhookEventoRepository
            .registrarRecebimento({
              provedor: "asaas",
              eventoId: "evt_1",
              tipoEvento:
                "PAYMENT_CONFIRMED",
              recursoId: "pay_1",
            });

        expect(resultado).toEqual(
          expect.objectContaining({
            processar: false,
            novo: false,
          })
        );

        expect(db.query)
          .toHaveBeenCalledTimes(3);
      }
    );
  }
);
