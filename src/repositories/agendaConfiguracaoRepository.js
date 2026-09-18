const db = require("../db/db");

async function buscarVinculoAtivoPorPapel(
  profissionalId,
  papel,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT
      u.id,
      un.negocio_id,
      un.papel
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE u.id = $1
      AND un.papel = $2
      AND u.ativo = TRUE
      AND un.ativo = TRUE
      AND n.ativo = TRUE
    ORDER BY
      un.created_at ASC,
      un.id ASC
    LIMIT 1
    `,
    [
      profissionalId,
      papel,
    ]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalAtivo(
  profissionalId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT
      u.id,
      un.negocio_id,
      un.papel
    FROM usuarios u
    INNER JOIN usuarios_negocios un
      ON un.usuario_id = u.id
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE u.id = $1
      AND un.negocio_id = $2
      AND u.ativo = TRUE
      AND un.ativo = TRUE
      AND un.papel IN (
        'dono',
        'profissional'
      )
      AND n.ativo = TRUE
    LIMIT 1
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  return result.rows[0] || null;
}

async function buscarConfiguracao(
  profissionalId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT *
    FROM agenda_configuracoes
    WHERE profissional_id = $1
      AND negocio_id = $2
    LIMIT 1
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  return result.rows[0] || null;
}

async function criarConfiguracao({
  profissionalId,
  negocioId,
  duracaoPadrao,
  intervaloMinutos,
  antecedenciaAgendamento,
  antecedenciaCancelamento
}, executor = db) {
  const result = await executor.query(
    `
    INSERT INTO agenda_configuracoes (
      profissional_id,
      negocio_id,
      duracao_padrao,
      intervalo_minutos,
      antecedencia_agendamento,
      antecedencia_cancelamento,
      origem_horarios
    )
    VALUES ($1,$2,$3,$4,$5,$6,'padrao_af')
    RETURNING *
    `,
    [
      profissionalId,
      negocioId,
      duracaoPadrao,
      intervaloMinutos,
      antecedenciaAgendamento,
      antecedenciaCancelamento
    ]
  );

  return result.rows[0];
}

async function atualizarConfiguracao({
  profissionalId,
  negocioId,
  duracaoPadrao,
  intervaloMinutos,
  antecedenciaAgendamento,
  antecedenciaCancelamento
}, executor = db) {
  const result = await executor.query(
    `
    UPDATE agenda_configuracoes
    SET
      duracao_padrao = $1,
      intervalo_minutos = $2,
      antecedencia_agendamento = $3,
      antecedencia_cancelamento = $4,
      updated_at = NOW()
    WHERE profissional_id = $5
      AND negocio_id = $6
    RETURNING *
    `,
    [
      duracaoPadrao,
      intervaloMinutos,
      antecedenciaAgendamento,
      antecedenciaCancelamento,
      profissionalId,
      negocioId
    ]
  );

  return result.rows[0] || null;
}

async function marcarConfigurada(
  profissionalId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE agenda_configuracoes
    SET
      configurado_em = COALESCE(
        configurado_em,
        NOW()
      ),
      origem_horarios = 'personalizado',
      primeira_personalizacao_em = COALESCE(
        primeira_personalizacao_em,
        NOW()
      ),
      ultima_personalizacao_em = NOW(),
      updated_at = NOW()
    WHERE profissional_id = $1
      AND negocio_id = $2
    RETURNING *
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  return result.rows[0] || null;
}

async function listarHorarios(
  profissionalId,
  negocioId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT *
    FROM agenda_horarios
    WHERE profissional_id = $1
      AND negocio_id = $2
    ORDER BY dia_semana
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  return result.rows;
}

async function salvarHorario({
  profissionalId,
  negocioId,
  diaSemana,
  trabalha,
  horaInicio,
  horaFim,
  intervaloInicio,
  intervaloFim
}, executor = db) {
  const result = await executor.query(
    `
    INSERT INTO agenda_horarios (
      profissional_id,
      negocio_id,
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)

    ON CONFLICT (
      profissional_id,
      negocio_id,
      dia_semana
    )

    DO UPDATE SET

      trabalha = EXCLUDED.trabalha,
      hora_inicio = EXCLUDED.hora_inicio,
      hora_fim = EXCLUDED.hora_fim,
      intervalo_inicio = EXCLUDED.intervalo_inicio,
      intervalo_fim = EXCLUDED.intervalo_fim,
      updated_at = NOW()

    RETURNING *;
    `,
    [
      profissionalId,
      negocioId,
      diaSemana,
      trabalha,
      horaInicio,
      horaFim,
      intervaloInicio,
      intervaloFim
    ]
  );

  return result.rows[0];
}

async function garantirDisponibilidadePadrao({
  profissionalId,
  negocioId,
}, executor = db) {
  await executor.query(
    `
    INSERT INTO agenda_configuracoes (
      profissional_id,
      negocio_id,
      duracao_padrao,
      intervalo_minutos,
      antecedencia_agendamento,
      antecedencia_cancelamento,
      configurado_em,
      origem_horarios
    )
    VALUES ($1,$2,60,0,0,2,NOW(),'padrao_af')
    ON CONFLICT (profissional_id, negocio_id)
    DO NOTHING
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  await executor.query(
    `
    INSERT INTO agenda_horarios (
      profissional_id,
      negocio_id,
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    SELECT
      $1,
      $2,
      d.dia_semana,
      d.trabalha,
      d.hora_inicio,
      d.hora_fim,
      d.intervalo_inicio,
      d.intervalo_fim
    FROM (
      VALUES
        (0::SMALLINT, FALSE, NULL::TIME, NULL::TIME, NULL::TIME, NULL::TIME),
        (1::SMALLINT, TRUE, TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (2::SMALLINT, TRUE, TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (3::SMALLINT, TRUE, TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (4::SMALLINT, TRUE, TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (5::SMALLINT, TRUE, TIME '08:00', TIME '18:00', TIME '12:00', TIME '13:00'),
        (6::SMALLINT, TRUE, TIME '08:00', TIME '13:00', NULL::TIME, NULL::TIME)
    ) AS d(
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    ON CONFLICT (
      profissional_id,
      negocio_id,
      dia_semana
    )
    DO NOTHING
    `,
    [
      profissionalId,
      negocioId,
    ]
  );

  const [configuracao, horarios] =
    await Promise.all([
      buscarConfiguracao(
        profissionalId,
        negocioId,
        executor
      ),
      listarHorarios(
        profissionalId,
        negocioId,
        executor
      ),
    ]);

  return {
    configuracao,
    horarios,
  };
}

module.exports = {
  buscarVinculoAtivoPorPapel,
  buscarProfissionalAtivo,
  buscarConfiguracao,
  criarConfiguracao,
  atualizarConfiguracao,
  marcarConfigurada,
  listarHorarios,
  salvarHorario,
  garantirDisponibilidadePadrao,
  executarTransacao:
    db.executarTransacao,
};
