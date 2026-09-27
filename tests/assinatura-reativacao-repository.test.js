jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn()
  })
);

const repository = require(
  "../src/repositories/assinaturaRepository"
);

describe(
  "Persistência da reativação de assinatura",
  () => {
    test(
      "reserva incrementa a versão monotônica apenas a partir de cancelado",
      async () => {
        const executor = {
          query: jest.fn()
            .mockResolvedValue({
              rows: [
                {
                  id: 20,
                  status:
                    "REACTIVATING",
                  reativacao_tentativa:
                    2
                }
              ]
            })
        };

        await repository
          .reservarReativacao(
            executor,
            {
              assinaturaId: 20,
              negocioId: 7
            }
          );

        const [sql, params] =
          executor.query.mock.calls[0];

        expect(sql).toContain(
          "reativacao_tentativa ="
        );
        expect(sql).toContain(
          "reativacao_tentativa + 1"
        );
        expect(sql).toContain(
          "'CANCELED'"
        );
        expect(sql).toContain(
          "'CANCELLED'"
        );
        expect(sql).not.toContain(
          "INTERVAL '2 minutes'"
        );
        expect(params)
          .toEqual([20, 7]);
      }
    );

    test(
      "recuperação abandonada apenas seleciona para reconciliação externa",
      async () => {
        const executor = {
          query: jest.fn()
            .mockResolvedValue({
              rows: []
            })
        };

        await repository
          .buscarReativacaoAbandonada(
            7,
            executor
          );

        const [sql, params] =
          executor.query.mock.calls[0];

        expect(
          sql.trim().startsWith(
            "SELECT"
          )
        ).toBe(true);
        expect(sql).toContain(
          "UPPER(status) = 'REACTIVATING'"
        );
        expect(sql).toContain(
          "INTERVAL '2 minutes'"
        );
        expect(sql).not.toContain(
          "UPDATE assinaturas"
        );
        expect(params)
          .toEqual([7]);
      }
    );
  }
);
