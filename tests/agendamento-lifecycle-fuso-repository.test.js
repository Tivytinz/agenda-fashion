jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
  })
);

const db = require(
  "../src/db/db"
);
const repository = require(
  "../src/repositories/agendamentoLifecycleRepository"
);

describe(
  "agendamentoLifecycleRepository no fuso do contexto",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      db.query.mockResolvedValue({
        rows: [],
      });
    });

    test(
      "Agenda geral converte ocupações pelo instante canônico para o fuso do negócio consultado",
      async () => {
        await repository
          .listarAgendamentosProfissionaisDoNegocioPorPeriodo({
            negocioId: 55,
            profissionalIds: [
              7,
              8,
            ],
            dataInicio:
              "2026-09-29",
            dataFim:
              "2026-10-05",
          });

        const [
          sql,
          parametros,
        ] =
          db.query.mock.calls[0];

        expect(sql).toContain(
          "negocio_contexto.id = $1"
        );
        expect(sql).toContain(
          "a.inicio_previsto_em"
        );
        expect(sql).toContain(
          "AT TIME ZONE"
        );
        expect(sql).toContain(
          ")::date"
        );
        expect(parametros).toEqual([
          55,
          [
            7,
            8,
          ],
          "2026-09-29",
          "2026-10-05",
        ]);
      }
    );
  }
);
