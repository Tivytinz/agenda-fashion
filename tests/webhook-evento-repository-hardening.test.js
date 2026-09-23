jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
    executarTransacao: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);

const webhookEventoRepository = require(
  "../src/repositories/webhookEventoRepository"
);

describe(
  "Hardening da fila de webhooks",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      db.executarTransacao
        .mockImplementation(
          async (callback) =>
            callback({
              query: db.query
            })
        );
    });

    test(
      "não reserva evento acima do limite de dez tentativas",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await webhookEventoRepository
          .reservarProximo();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "status = 'PENDING'"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "status = 'PROCESSING'"
        );
        expect(
          sql.match(/tentativas < 10/g)
        ).toHaveLength(3);
      }
    );

    test(
      "retorna o número da tentativa como lease ao reservar",
      async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                provedor: "asaas",
                recurso_id: "pay_1"
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: []
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: 1,
                status: "PROCESSING",
                tentativas: 2,
                lease_tentativa: 2
              }
            ]
          });

        const evento =
          await webhookEventoRepository
            .reservarPorId(1);

        expect(evento.lease_tentativa)
          .toBe(2);
        expect(
          db.executarTransacao
        ).toHaveBeenCalledTimes(1);
        expect(
          db.query.mock.calls[1][0]
        ).toContain(
          "pg_advisory_xact_lock"
        );
        expect(
          db.query.mock.calls[2][0]
        ).toContain(
          "tentativas"
        );
        expect(
          db.query.mock.calls[2][0]
        ).toContain(
          "AS lease_tentativa"
        );
      }
    );

    test(
      "conclui somente se a tentativa ainda possui o lease",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PROCESSED"
            }
          ]
        });

        await webhookEventoRepository
          .marcarConcluido(
            1,
            "PROCESSED",
            3
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "status = 'PROCESSING'"
        );
        expect(sql).toContain(
          "tentativas = $3"
        );
        expect(parametros).toEqual([
          1,
          "PROCESSED",
          3
        ]);
      }
    );

    test(
      "não agenda nova tentativa depois da décima falha",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await webhookEventoRepository
          .marcarFalha(
            1,
            "erro temporário",
            10
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "WHEN tentativas < 10"
        );
        expect(sql).toContain(
          "ELSE NULL"
        );
        expect(sql).toContain(
          "tentativas = $3"
        );
        expect(parametros).toEqual([
          1,
          "erro temporário",
          10
        ]);
      }
    );

    test(
      "marca PROCESSING esgotado como falha terminal",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await webhookEventoRepository
          .marcarProcessamentosEsgotados();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "tentativas >= 10"
        );
        expect(sql).toContain(
          "INTERVAL '5 minutes'"
        );
        expect(sql).toContain(
          "proxima_tentativa_em = NULL"
        );
      }
    );
  }
);
