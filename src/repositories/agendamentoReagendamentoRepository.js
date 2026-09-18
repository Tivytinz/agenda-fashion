const db = require("../db/db");

async function buscarAgendamentoParaReagendar({
  agendamentoId,
  negocioId,
  usuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        a.id,
        a.negocio_id,
        a.servico_id,
        a.profissional_id,
        a.client_id,
        a.cliente_id,
        a.status,
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
        a.servico_nome,
        a.valor_servico,
        a.duracao_minutos,
        a.antecedencia_cancelamento_horas,
        a.atendimento_iniciado_em,
        a.atendimento_iniciado_por,
        COALESCE(
          NULLIF(n.fuso_horario, ''),
          'America/Sao_Paulo'
        ) AS fuso_horario,
        un.papel AS papel_executor
      FROM agendamentos a
      INNER JOIN negocios n
        ON n.id = a.negocio_id
        AND n.ativo = TRUE
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = a.negocio_id
        AND un.usuario_id = $3
        AND un.ativo = TRUE
      INNER JOIN usuarios executor_usuario
        ON executor_usuario.id = un.usuario_id
        AND executor_usuario.ativo = TRUE
      WHERE a.id = $1
        AND a.negocio_id = $2
      LIMIT 1
      FOR UPDATE OF a, un
    `,
    [agendamentoId, negocioId, usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalAtivoNoNegocio({
  profissionalId,
  negocioId,
  servicoId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        un.usuario_id AS profissional_id,
        un.papel,
        COALESCE(
          un.nome_exibicao,
          u.nome
        ) AS nome
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      INNER JOIN profissional_servicos ps
        ON ps.negocio_id = un.negocio_id
        AND ps.profissional_id = un.usuario_id
        AND ps.servico_id = $3
      INNER JOIN servicos_negocio s
        ON s.id = ps.servico_id
        AND s.negocio_id = ps.negocio_id
        AND s.ativo = TRUE
      WHERE un.usuario_id = $1
        AND un.negocio_id = $2
        AND un.ativo = TRUE
        AND un.papel IN ('dono', 'profissional')
      LIMIT 1
    `,
    [profissionalId, negocioId, servicoId]
  );

  return result.rows[0] || null;
}

async function atualizarReagendamento({
  agendamentoId,
  profissionalId,
  data,
  horario,
  executor = db,
}) {
  const result = await executor.query(
    `
      UPDATE agendamentos
      SET
        profissional_id = $2,
        data = $3,
        horario = $4
      WHERE id = $1
        AND status IN ('agendado', 'confirmado')
        AND atendimento_iniciado_em IS NULL
      RETURNING
        id,
        negocio_id,
        servico_id,
        profissional_id,
        client_id,
        cliente_id,
        status,
        TO_CHAR(data, 'YYYY-MM-DD') AS data,
        TO_CHAR(horario::time, 'HH24:MI') AS horario,
        servico_nome,
        valor_servico,
        duracao_minutos,
        antecedencia_cancelamento_horas
    `,
    [
      agendamentoId,
      profissionalId,
      data,
      horario,
    ]
  );

  return result.rows[0] || null;
}

async function registrarHistoricoReagendamento({
  agendamentoId,
  negocioId,
  actorUserId,
  actorType,
  previousProfissionalId,
  newProfissionalId,
  previousData,
  previousHorario,
  newData,
  newHorario,
  antecedenciaCancelamentoHoras,
  executor = db,
}) {
  const result = await executor.query(
    `
      INSERT INTO agendamento_reagendamentos (
        agendamento_id,
        negocio_id,
        actor_user_id,
        actor_type,
        previous_profissional_id,
        new_profissional_id,
        previous_data,
        previous_horario,
        new_data,
        new_horario,
        antecedencia_cancelamento_horas_snapshot
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11
      )
      RETURNING
        id,
        agendamento_id,
        actor_user_id,
        actor_type,
        previous_profissional_id,
        new_profissional_id,
        TO_CHAR(previous_data, 'YYYY-MM-DD') AS previous_data,
        TO_CHAR(previous_horario::time, 'HH24:MI') AS previous_horario,
        TO_CHAR(new_data, 'YYYY-MM-DD') AS new_data,
        TO_CHAR(new_horario::time, 'HH24:MI') AS new_horario,
        antecedencia_cancelamento_horas_snapshot,
        created_at
    `,
    [
      agendamentoId,
      negocioId,
      actorUserId,
      actorType,
      previousProfissionalId,
      newProfissionalId,
      previousData,
      previousHorario,
      newData,
      newHorario,
      antecedenciaCancelamentoHoras,
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarAgendamentoParaReagendar,
  buscarProfissionalAtivoNoNegocio,
  atualizarReagendamento,
  registrarHistoricoReagendamento,
};
