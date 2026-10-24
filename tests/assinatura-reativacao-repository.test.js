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
        expect(sql).toContain("INSERT INTO assinatura_renovacao_operacoes");
        expect(params)
          .toEqual([20, 7]);
      }
    );

  }
);
