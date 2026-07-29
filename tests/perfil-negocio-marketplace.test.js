jest.mock(
  "../src/repositories/perfilNegocioRepository"
);

const repository = require(
  "../src/repositories/perfilNegocioRepository"
);

const service = require(
  "../src/services/perfilNegocioService"
);

describe(
  "catálogo público do marketplace",
  () => {
    afterEach(
      () => {
        jest.clearAllMocks();
      }
    );

    test(
      "entrega os serviços junto de cada negócio",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([
            {
              id: 1,
              nome: "Studio Bella",
              areas: null,
              servicos: [
                {
                  id: 10,
                  nome: "Alongamento em gel",
                  valor: "120.00",
                },
              ],
            },
          ]);

        const resultado =
          await service
            .listarNegociosPublicos();

        expect(
          resultado.negocios[0]
            .servicos
        ).toEqual([
          expect.objectContaining({
            id: 10,
            nome:
              "Alongamento em gel",
          }),
        ]);
      }
    );

    test(
      "normaliza negócios antigos sem serviços",
      async () => {
        repository
          .listarNegociosPublicos
          .mockResolvedValue([
            {
              id: 2,
              nome: "Espaço Hair",
              servicos: null,
            },
          ]);

        const resultado =
          await service
            .listarNegociosPublicos();

        expect(
          resultado.negocios[0]
            .servicos
        ).toEqual([]);
      }
    );
  }
);
