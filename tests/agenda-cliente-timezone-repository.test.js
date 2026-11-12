jest.mock(
  "../src/db/db",
  () => ({
    query: jest.fn(),
  })
);

const db =
  require("../src/db/db");
const agendamentoLifecycleRepository =
  require(
    "../src/repositories/agendamentoLifecycleRepository"
  );
const agendamentoCancelamentoRepository =
  require(
    "../src/repositories/agendamentoCancelamentoRepository"
  );

describe(
  "agenda do cliente e lifecycle persistido",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "bloqueia somente a linha do booking no cancelamento do cliente",
      async () => {
        const executor = {
          query:
            jest.fn()
              .mockResolvedValue({
                rows: [],
              }),
        };

        await agendamentoCancelamentoRepository
          .buscarAgendamentoClienteParaCancelar({
            agendamentoId: 15,
            clienteId: 9,
            executor,
          });

        const [
          sql,
          parametros,
        ] =
          executor.query
            .mock.calls[0];

        expect(
          sql
        ).toContain(
          "INNER JOIN negocios n"
        );
        expect(
          sql
        ).toContain(
          "FOR UPDATE OF a"
        );
        expect(
          sql
        ).not.toMatch(
          /FOR UPDATE\s*(?:$|;)/m
        );
        expect(
          parametros
        ).toEqual([
          15,
          9,
        ]);
      }
    );

    test(
      "listagem usa o status persistido e não inventa realizado pelo relógio",
      async () => {
        db.query
          .mockResolvedValue({
            rows: [],
          });

        await agendamentoLifecycleRepository
          .listarAgendamentosCliente(
            9
          );

        const [
          sql,
          parametros,
        ] =
          db.query
            .mock.calls[0];

        expect(
          sql
        ).toContain(
          "a.status"
        );
        expect(
          sql
        ).not.toContain(
          "NOW() AT TIME ZONE"
        );
        expect(
          sql
        ).not.toMatch(
          /THEN\s+'realizado'/i
        );
        expect(
          parametros
        ).toEqual([
          9,
        ]);
      }
    );
  }
);
