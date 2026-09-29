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
  "../src/repositories/whatsappAgendaRepository"
);

describe(
  "whatsappAgendaRepository",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test(
      "considera agenda configurada apenas no mesmo negócio e após personalização explícita",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              configurada: true,
            },
          ],
        });

        await expect(
          repository
            .negocioTemAgendaConfigurada(
              11
            )
        ).resolves.toBe(true);

        const [consulta] =
          db.query.mock.calls[0];
        const sql =
          consulta.replace(
            /\s+/g,
            " "
          );

        expect(sql).toContain(
          "ac.negocio_id = un.negocio_id"
        );
        expect(sql).toContain(
          "ac.origem_horarios = 'personalizado'"
        );
        expect(sql).not.toContain(
          "ac.configurado_em IS NOT NULL"
        );
      }
    );

    test(
      "revalida divulgação com os mesmos sinais estruturais da ativação",
      async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              pode_divulgar: true,
            },
          ],
        });

        await expect(
          repository
            .negocioPodeDivulgarParaPrimeiroAgendamento(
              11
            )
        ).resolves.toBe(true);

        const [consulta, parametros] =
          db.query.mock.calls[0];
        const sql =
          consulta.replace(
            /\s+/g,
            " "
          );

        expect(sql).toContain(
          "n.publicado = TRUE"
        );
        expect(sql).toContain(
          "disponibilidade_s.duracao_minutos"
        );
        expect(sql).toContain(
          "ativacao_agendamento.status NOT IN"
        );
        expect(sql).toContain(
          "'cancelamento_solicitado'"
        );
        expect(parametros).toEqual([
          11,
        ]);
      }
    );

    test(
      "não consulta o banco para id inválido",
      async () => {
        await expect(
          repository
            .negocioPodeDivulgarParaPrimeiroAgendamento(
              "invalido"
            )
        ).resolves.toBe(false);

        expect(
          db.query
        ).not.toHaveBeenCalled();
      }
    );
  }
);
