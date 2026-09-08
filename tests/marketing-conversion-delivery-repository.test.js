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
      "reserva com SKIP LOCKED e limita a cinco tentativas",
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
  }
);
