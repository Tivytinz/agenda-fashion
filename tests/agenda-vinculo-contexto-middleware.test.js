jest.mock(
  "../src/repositories/agendaRepository",
  () => ({
    buscarVinculoUsuarioNegocio:
      jest.fn(),
  })
);

const agendaRepository = require(
  "../src/repositories/agendaRepository"
);
const agendaVinculoAtivo = require(
  "../src/middlewares/agendaVinculoAtivo"
);

describe(
  "agendaVinculoAtivo",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "usa o contexto profissional explícito em endpoint compartilhado",
      async () => {
        agendaRepository
          .buscarVinculoUsuarioNegocio
          .mockResolvedValue({
            negocio_id: 22,
            papel: "profissional",
            fuso_horario:
              "America/Cuiaba",
          });

        const req = {
          user: {
            id: 7,
          },
          get: jest.fn(
            () =>
              "profissional"
          ),
        };
        const next =
          jest.fn();

        await agendaVinculoAtivo(
          req,
          {},
          next
        );

        expect(
          agendaRepository
            .buscarVinculoUsuarioNegocio
        ).toHaveBeenCalledWith(
          7,
          "profissional"
        );

        expect(
          req.agendaContexto
        ).toEqual({
          negocioId: 22,
          papel: "profissional",
          fusoHorario:
            "America/Cuiaba",
        });

        expect(next)
          .toHaveBeenCalledWith();
      }
    );

    test(
      "rejeita contexto explícito inválido em vez de cair em outro vínculo",
      async () => {
        const req = {
          user: {
            id: 7,
          },
          get: jest.fn(
            () => "administrador"
          ),
        };
        const next =
          jest.fn();

        await agendaVinculoAtivo(
          req,
          {},
          next
        );

        expect(
          agendaRepository
            .buscarVinculoUsuarioNegocio
        ).not.toHaveBeenCalled();

        expect(next)
          .toHaveBeenCalledWith(
            expect.objectContaining({
              statusCode: 400,
              message:
                "Contexto da agenda inválido.",
            })
          );
      }
    );

    test(
      "preserva compatibilidade quando o contexto não foi enviado",
      async () => {
        agendaRepository
          .buscarVinculoUsuarioNegocio
          .mockResolvedValue({
            negocio_id: 9,
            papel: "dono",
            fuso_horario:
              "America/Sao_Paulo",
          });

        const req = {
          user: {
            id: 3,
          },
          get: jest.fn(
            () => null
          ),
        };
        const next =
          jest.fn();

        await agendaVinculoAtivo(
          req,
          {},
          next
        );

        expect(
          agendaRepository
            .buscarVinculoUsuarioNegocio
        ).toHaveBeenCalledWith(
          3,
          null
        );
      }
    );
  }
);
