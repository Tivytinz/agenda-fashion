jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);

const agendaPublicaRepository = require(
  "../src/repositories/agendaPublicaRepository"
);

describe(
  "Publicação no agendamento público",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      db.query.mockResolvedValue({
        rows: [],
      });
    });

    test(
      "não resolve negócio não publicado apenas por conhecer o slug",
      async () => {
        await agendaPublicaRepository
          .buscarNegocioPorSlug(
            "studio-oculto"
          );

        const [sql, parametros] =
          db.query.mock.calls[0];

        expect(
          sql
        ).toContain(
          "AND ativo = TRUE"
        );

        expect(
          sql
        ).toContain(
          "AND publicado = TRUE"
        );

        expect(
          parametros
        ).toEqual([
          "studio-oculto",
        ]);
      }
    );
  }
);
