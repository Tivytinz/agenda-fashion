const db = require(
  "../src/db/db"
);
const dashboardActivationRepository = require(
  "../src/repositories/dashboardActivationRepository"
);
const {
  criarCenarioAgendamento,
  removerCenarioAgendamento,
} = require(
  "./helpers/cenarioAgendamento"
);

describe(
  "dashboardActivationRepository integrado",
  () => {
    let cenario;

    beforeEach(async () => {
      cenario = await criarCenarioAgendamento(
        db,
        {
          prefixo:
            "dashboard-activation",
        }
      );
    });

    afterEach(async () => {
      await removerCenarioAgendamento(
        db,
        cenario
      );
    });

    test(
      "usa publicação e agenda confirmada como estado canônico",
      async () => {
        const estado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(estado).toMatchObject({
          negocio_publicado: true,
          agenda_configurada: true,
          primeiro_agendamento_recebido: false,
        });

        await db.query(
          `
            UPDATE negocios
            SET publicado = FALSE
            WHERE id = $1
          `,
          [cenario.negocioId]
        );

        await db.query(
          `
            UPDATE agenda_configuracoes
            SET configurado_em = NULL
            WHERE profissional_id = $1
          `,
          [cenario.profissional.id]
        );

        const atualizado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(atualizado).toMatchObject({
          negocio_publicado: false,
          agenda_configurada: false,
          primeiro_agendamento_recebido: false,
        });
      }
    );

    test(
      "considera o primeiro agendamento real mesmo se ele for cancelado depois",
      async () => {
        const inserido = await db.query(
          `
            INSERT INTO agendamentos (
              negocio_id,
              servico_id,
              profissional_id,
              cliente_id,
              data,
              horario,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $3,
              CURRENT_DATE + 1,
              '10:00',
              'agendado'
            )
            RETURNING id
          `,
          [
            cenario.negocioId,
            cenario.servico.id,
            cenario.profissional.id,
          ]
        );

        await db.query(
          `
            UPDATE agendamentos
            SET status = 'cancelado'
            WHERE id = $1
          `,
          [inserido.rows[0].id]
        );

        const estado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          estado.primeiro_agendamento_recebido
        ).toBe(true);
      }
    );
  }
);
