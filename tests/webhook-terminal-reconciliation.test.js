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

test(
  "a tentativa terminal ainda pode reconciliar sucesso com o mesmo lease",
  async () => {
    db.query.mockResolvedValueOnce({
      rows: []
    });

    await repository
      .marcarConcluido(
        17,
        "PROCESSED",
        10
      );

    const [sql, parametros] =
      db.query.mock.calls[0];

    expect(sql).toContain(
      "tentativas = $3"
    );
    expect(sql).toContain(
      "status = 'FAILED'"
    );
    expect(sql).toContain(
      "tentativas >= 10"
    );
    expect(sql).toContain(
      "INTERVAL '5 minutes'"
    );
    expect(parametros).toEqual([
      17,
      "PROCESSED",
      10
    ]);
  }
);
