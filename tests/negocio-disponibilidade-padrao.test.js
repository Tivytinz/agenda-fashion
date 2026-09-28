const negocioRepository = require(
  "../src/repositories/negocioRepository"
);

describe(
  "disponibilidade padrão do negócio",
  () => {
    test(
      "cria a política automática com antecedência de cancelamento de 2 horas",
      async () => {
        const executor = {
          query:
            jest.fn()
              .mockResolvedValue({
                rows: [],
              }),
        };

        await negocioRepository
          .criarDisponibilidadePadrao(
            7,
            11,
            executor
          );

        expect(
          executor.query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            "VALUES ($1, $2, 60, 0, 0, 2, NOW(), 'padrao_af')"
          ),
          [
            7,
            11,
          ]
        );

        expect(
          executor.query
        ).toHaveBeenCalledTimes(
          2
        );
      }
    );
  }
);
