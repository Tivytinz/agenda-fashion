jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const db = require(
  "../src/db/db"
);

const repository = require(
  "../src/repositories/webhookEventoRepository"
);

describe(
  "Ordenação da fila de webhooks por recurso",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "persiste a data de criação informada pelo provedor",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "PENDING"
            }
          ]
        });

        await repository
          .registrarRecebimento({
            provedor: "asaas",
            eventoId: "evt_1",
            tipoEvento: "PAYMENT_RECEIVED",
            recursoId: "pay_1",
            eventoCriadoEm:
              "2026-09-13 20:10:11",
            payload: {
              id: "evt_1"
            }
          });

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql)
          .toContain("evento_criado_em");
        expect(sql)
          .toContain("$5::timestamp");
        expect(parametros[4])
          .toBe("2026-09-13 20:10:11");
      }
    );

    test(
      "marca como obsoleto somente quando existe evento mais recente do mesmo recurso",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              status: "IGNORED"
            }
          ]
        });

        await repository
          .marcarObsoletoSeNecessario(1);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql)
          .toContain(
            "recente.recurso_id = evento.recurso_id"
          );
        expect(sql)
          .toContain(
            "recente.evento_criado_em >"
          );
        expect(sql)
          .toContain(
            "evento.status = 'PROCESSING'"
          );
        expect(sql)
          .toContain(
            "INTERVAL '5 minutes'"
          );
        expect(parametros)
          .toEqual([1]);
      }
    );

    test(
      "não reserva dois eventos ativos do mesmo recurso ao mesmo tempo",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .reservarPorId(2);

        const sql =
          db.query.mock.calls[0][0];

        expect(sql)
          .toContain(
            "outro.recurso_id = evento.recurso_id"
          );
        expect(sql)
          .toContain(
            "outro.status = 'PROCESSING'"
          );
        expect(sql)
          .toContain(
            "outro.ultima_tentativa_em >="
          );
      }
    );

    test(
      "worker também respeita exclusão mútua por recurso",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .reservarProximo();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql)
          .toContain(
            "FOR UPDATE SKIP LOCKED"
          );
        expect(sql)
          .toContain(
            "outro.status = 'PROCESSING'"
          );
      }
    );
  }
);
