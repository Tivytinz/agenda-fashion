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
  "../src/repositories/marketingConversionDeliveryRepository"
);

describe(
  "Fila persistente de conversões de marketing",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "reserva com SKIP LOCKED, limita a cinco tentativas e só repete FAILED agendado",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .reservarProximo();

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "FOR UPDATE SKIP LOCKED"
        );
        expect(
          sql.match(/tentativas < 5/g)
        ).toHaveLength(3);
        expect(sql).toContain(
          "proxima_tentativa_em IS NOT NULL"
        );
        expect(sql).toContain(
          "proxima_tentativa_em <= NOW()"
        );
      }
    );

    test(
      "finalização usa lease e reconcilia tentativa terminal antiga",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarEnviado(9, 5);

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5
        ]);
      }
    );

    test(
      "resultado ignorado também reconcilia a mesma tentativa terminal",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarIgnorado(
            9,
            5,
            "sem_consentimento"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "tentativas = $2"
        );
        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "tentativas >= 5"
        );
        expect(parametros).toEqual([
          9,
          5,
          "sem_consentimento"
        ]);
      }
    );

    test(
      "quinta falha não agenda uma sexta tentativa",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalha(
            9,
            5,
            "falha externa"
          );

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "WHEN tentativas < 5"
        );
        expect(sql).toContain(
          "ELSE NULL"
        );
      }
    );

    test(
      "falha técnica terminal não fica elegível a retry",
      async () => {
        db.query.mockResolvedValueOnce({
          rows: []
        });

        await repository
          .marcarFalhaTerminal(
            9,
            2,
            "event_id_invalido"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "status = 'FAILED'"
        );
        expect(sql).toContain(
          "proxima_tentativa_em = NULL"
        );
        expect(sql).toContain(
          "status = 'PROCESSING'"
        );
        expect(sql).not.toContain(
          "WHEN tentativas < 5"
        );
        expect(parametros).toEqual([
          9,
          2,
          "event_id_invalido"
        ]);
      }
    );
  }
);
