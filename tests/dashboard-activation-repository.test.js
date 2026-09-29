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
  "../src/repositories/dashboardActivationRepository"
);

describe(
  "dashboardActivationRepository",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      db.query.mockResolvedValue({
        rows: [{
          possui_servico: true,
          possui_servico_ativo: true,
          negocio_publicado: true,
          agenda_configurada: false,
          primeiro_agendamento_recebido: false,
        }],
      });
    });

    test(
      "isola a agenda pelo negócio, exige personalização e ignora cancelamento legado em revisão",
      async () => {
        await repository
          .buscarEstadoAtivacao(11);

        const sql =
          db.query.mock.calls[0][0];

        expect(sql).toContain(
          "AND ac.negocio_id ="
        );
        expect(sql).toContain(
          "ac.origem_horarios ="
        );
        expect(sql).toContain(
          "'personalizado'"
        );
        expect(sql).toContain(
          "'cancelamento_solicitado'"
        );
        expect(sql).toContain(
          "'cancelado'"
        );
        expect(sql).toContain(
          "INNER JOIN agenda_horarios ah"
        );
        expect(sql).toContain(
          "INNER JOIN profissional_servicos ps"
        );
        expect(sql).toContain(
          "AS possui_disponibilidade_agendavel"
        );
        expect(
          db.query.mock.calls[0][1]
        ).toEqual([11]);
      }
    );
  }
);
