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

    test("diagnostica habilitação, faixas e duração sem divergir do sinal usado pelo WhatsApp", async () => {
      const { sqlPossuiDisponibilidadeAgendavel } = require("../src/repositories/ativacaoSql");
      async function verificar(motivo) {
        const estado = await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId);
        const { rows } = await db.query(`SELECT ${sqlPossuiDisponibilidadeAgendavel("$1")} AS disponivel`, [cenario.negocioId]);
        expect(estado.motivo_indisponibilidade).toBe(motivo);
        expect(estado.possui_disponibilidade_agendavel).toBe(motivo === null);
        expect(rows[0].disponivel).toBe(estado.possui_disponibilidade_agendavel);
      }
      await verificar(null);
      await db.query("UPDATE agenda_horarios SET trabalha = FALSE WHERE negocio_id = $1", [cenario.negocioId]);
      await verificar("SEM_HORARIOS");
      await db.query(`UPDATE agenda_horarios SET trabalha = TRUE, hora_inicio = '09:00', hora_fim = '09:30', intervalo_inicio = NULL, intervalo_fim = NULL WHERE negocio_id = $1 AND dia_semana = 1`, [cenario.negocioId]);
      await verificar("DURACAO_INCOMPATIVEL");
      await db.query(`UPDATE agenda_horarios SET hora_fim = '10:00' WHERE negocio_id = $1 AND dia_semana = 1`, [cenario.negocioId]);
      await verificar(null);
      // The day is long enough in total, but neither side of the pause fits the service.
      await db.query(`UPDATE agenda_horarios SET hora_fim = '11:00', intervalo_inicio = '09:30', intervalo_fim = '10:30' WHERE negocio_id = $1 AND dia_semana = 1`, [cenario.negocioId]);
      await verificar("DURACAO_INCOMPATIVEL");
      await db.query("DELETE FROM agenda_horarios WHERE negocio_id = $1", [cenario.negocioId]);
      await verificar("SEM_HORARIOS");
      await db.query("DELETE FROM profissional_servicos WHERE negocio_id = $1", [cenario.negocioId]);
      await verificar("SEM_PROFISSIONAL_HABILITADA");
    });

    test("revisa a equipe quando só outra profissional está habilitada, sem usar horários da dona", async () => {
      const equipe = await criarCenarioAgendamento(db, { prefixo: "activation-team-target" });
      try {
        await db.query("INSERT INTO usuarios_negocios (usuario_id, negocio_id, papel, ativo) VALUES ($1, $2, 'profissional', TRUE)", [equipe.profissional.id, cenario.negocioId]);
        await db.query("INSERT INTO profissional_servicos (negocio_id, profissional_id, servico_id, habilitado_por_usuario_id) VALUES ($1, $2, $3, $4)", [cenario.negocioId, equipe.profissional.id, cenario.servico.id, cenario.profissional.id]);
        await db.query(`INSERT INTO agenda_horarios (profissional_id, negocio_id, dia_semana, trabalha, hora_inicio, hora_fim)
          SELECT $1, negocio_id, dia_semana, TRUE, '09:00'::TIME, '09:30'::TIME FROM agenda_horarios WHERE negocio_id = $2 AND profissional_id = $3`, [equipe.profissional.id, cenario.negocioId, cenario.profissional.id]);
        expect(await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId)).toMatchObject({ possui_disponibilidade_agendavel: true, revisar_horarios_na_equipe: false });
        await db.query("DELETE FROM profissional_servicos WHERE negocio_id = $1 AND profissional_id = $2", [cenario.negocioId, cenario.profissional.id]);
        expect(await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId)).toMatchObject({ motivo_indisponibilidade: "DURACAO_INCOMPATIVEL", revisar_horarios_na_equipe: true });
        await db.query("UPDATE agenda_horarios SET trabalha = FALSE WHERE negocio_id = $1 AND profissional_id = $2", [cenario.negocioId, equipe.profissional.id]);
        expect(await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId)).toMatchObject({ motivo_indisponibilidade: "SEM_HORARIOS", revisar_horarios_na_equipe: true });
        await db.query("UPDATE agenda_horarios SET trabalha = TRUE, hora_fim = '10:00' WHERE negocio_id = $1 AND profissional_id = $2", [cenario.negocioId, equipe.profissional.id]);
        expect(await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId)).toMatchObject({ possui_disponibilidade_agendavel: true, motivo_indisponibilidade: null, revisar_horarios_na_equipe: false });
      } finally {
        await db.query("DELETE FROM profissional_servicos WHERE negocio_id = $1 AND profissional_id = $2", [cenario.negocioId, equipe.profissional.id]);
        await db.query("DELETE FROM agenda_horarios WHERE negocio_id = $1 AND profissional_id = $2", [cenario.negocioId, equipe.profissional.id]);
        await db.query("DELETE FROM usuarios_negocios WHERE negocio_id = $1 AND usuario_id = $2", [cenario.negocioId, equipe.profissional.id]);
        await removerCenarioAgendamento(db, equipe);
      }
    });

    test("distingue ocultação manual de uma publicação ainda pendente", async () => {
      await db.query(
        "UPDATE negocios SET publicado = FALSE, despublicado_manual_em = NOW() WHERE id = $1",
        [cenario.negocioId]
      );
      const pausado = await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId);
      expect(pausado).toMatchObject({
        negocio_publicado: false,
        publicacao_pausada_manualmente: true,
        possui_servico_ativo: true,
      });

      await db.query(
        "UPDATE negocios SET despublicado_manual_em = NULL WHERE id = $1",
        [cenario.negocioId]
      );
      const pendente = await dashboardActivationRepository.buscarEstadoAtivacao(cenario.negocioId);
      expect(pendente).toMatchObject({
        negocio_publicado: false,
        publicacao_pausada_manualmente: false,
      });
    });

    test(
      "usa serviço ativo, publicação e agenda confirmada como estado canônico",
      async () => {
        await db.query(
          `
            UPDATE agenda_configuracoes
            SET origem_horarios =
              'personalizado'
            WHERE profissional_id = $1
              AND negocio_id = $2
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        const estado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(estado).toMatchObject({
          possui_servico: true,
          possui_servico_ativo: true,
          negocio_publicado: true,
          agenda_configurada: true,
          possui_disponibilidade_agendavel:
            true,
          primeiro_agendamento_recebido: false,
        });

        await db.query(
          `
            UPDATE agenda_horarios
            SET
              trabalha = FALSE,
              hora_inicio = NULL,
              hora_fim = NULL,
              intervalo_inicio = NULL,
              intervalo_fim = NULL
            WHERE profissional_id = $1
              AND negocio_id = $2
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        await db.query(
          `
            UPDATE agenda_horarios
            SET
              trabalha = TRUE,
              hora_inicio = '09:00',
              hora_fim = '09:30'
            WHERE profissional_id = $1
              AND negocio_id = $2
              AND dia_semana = 1
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        const faixaCurta =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          faixaCurta
            .possui_disponibilidade_agendavel
        ).toBe(false);

        await db.query(
          `
            UPDATE agenda_horarios
            SET
              hora_fim = '10:00'
            WHERE profissional_id = $1
              AND negocio_id = $2
              AND dia_semana = 1
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        const faixaSuficiente =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          faixaSuficiente
            .possui_disponibilidade_agendavel
        ).toBe(true);

        await db.query(
          `
            UPDATE agenda_horarios
            SET
              trabalha = FALSE,
              hora_inicio = NULL,
              hora_fim = NULL
            WHERE profissional_id = $1
              AND negocio_id = $2
              AND dia_semana = 1
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        const semDisponibilidade =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          semDisponibilidade
            .possui_disponibilidade_agendavel
        ).toBe(false);

        await db.query(
          `
            UPDATE servicos_negocio
            SET ativo = FALSE
            WHERE id = $1
          `,
          [cenario.servico.id]
        );

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
            SET origem_horarios =
              'padrao_af'
            WHERE profissional_id = $1
              AND negocio_id = $2
          `,
          [
            cenario.profissional.id,
            cenario.negocioId,
          ]
        );

        const atualizado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(atualizado).toMatchObject({
          possui_servico: true,
          possui_servico_ativo: false,
          negocio_publicado: false,
          agenda_configurada: false,
          possui_disponibilidade_agendavel:
            false,
          primeiro_agendamento_recebido: false,
        });
      }
    );

    test(
      "ignora serviços inativos quando ainda existe outro serviço ativo",
      async () => {
        await db.query(
          `
            UPDATE servicos_negocio
            SET ativo = FALSE
            WHERE id = $1
          `,
          [cenario.servico.id]
        );

        const novoServico =
          await db.query(
            `
              INSERT INTO servicos_negocio (
                negocio_id,
                nome,
                descricao,
                valor,
                duracao_minutos,
                ativo
              )
              VALUES (
                $1,
                'Serviço Ativo Teste',
                'Serviço criado para validar o estado de ativação.',
                75,
                60,
                TRUE
              )
              RETURNING id
            `,
            [cenario.negocioId]
          );

        try {
          const estado =
            await dashboardActivationRepository
              .buscarEstadoAtivacao(
                cenario.negocioId
              );

          expect(
            estado.possui_servico_ativo
          ).toBe(true);
        } finally {
          await db.query(
            `
              DELETE FROM servicos_negocio
              WHERE id = $1
            `,
            [novoServico.rows[0].id]
          );
        }
      }
    );

    test(
      "encerra a ativação somente enquanto existir agendamento não cancelado",
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

        let estado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          estado.primeiro_agendamento_recebido
        ).toBe(true);

        await db.query(
          `
            UPDATE agendamentos
            SET status = 'cancelado'
            WHERE id = $1
          `,
          [inserido.rows[0].id]
        );

        estado =
          await dashboardActivationRepository
            .buscarEstadoAtivacao(
              cenario.negocioId
            );

        expect(
          estado.primeiro_agendamento_recebido
        ).toBe(false);

        await db.query(
          `
            UPDATE agendamentos
            SET status = 'realizado'
            WHERE id = $1
          `,
          [inserido.rows[0].id]
        );

        estado =
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
