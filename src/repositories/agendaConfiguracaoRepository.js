const db = require("../db/db");

async function buscarProfissionalAtivo(
  profissionalId,
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
      AND u.ativo = TRUE
      AND un.ativo = TRUE
      AND un.papel IN (
        'dono',
        'profissional'
      )
      AND n.ativo = TRUE
    ORDER BY
      CASE un.papel
        WHEN 'dono' THEN 1
        ELSE 2
      END
    LIMIT 1
    `,
    [profissionalId]
  );

  return result.rows[0] || null;
}

async function buscarConfiguracao(
  profissionalId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT *
    FROM agenda_configuracoes
    WHERE profissional_id = $1
    LIMIT 1
    `,
    [profissionalId]
  );

  return result.rows[0] || null;
}

async function criarConfiguracao({
  profissionalId,
  duracaoPadrao,
  intervaloMinutos,
  antecedenciaAgendamento,
  antecedenciaCancelamento
}, executor = db) {
  const result = await executor.query(
    `
    INSERT INTO agenda_configuracoes (
      profissional_id,
      duracao_padrao,
      intervalo_minutos,
      antecedencia_agendamento,
      antecedencia_cancelamento
    )
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      profissionalId,
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
    RETURNING *
    `,
    [
      duracaoPadrao,
      intervaloMinutos,
      antecedenciaAgendamento,
      antecedenciaCancelamento,
      profissionalId
    ]
  );

  return result.rows[0] || null;
}

async function marcarConfigurada(
  profissionalId,
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
      updated_at = NOW()
    WHERE profissional_id = $1
    RETURNING *
    `,
    [profissionalId]
  );

  return result.rows[0] || null;
}

async function listarHorarios(
  profissionalId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT *
    FROM agenda_horarios
    WHERE profissional_id = $1
    ORDER BY dia_semana
    `,
    [profissionalId]
  );

  return result.rows;
}

async function salvarHorario({
  profissionalId,
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
      dia_semana,
      trabalha,
      hora_inicio,
      hora_fim,
      intervalo_inicio,
      intervalo_fim
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)

    ON CONFLICT (profissional_id,dia_semana)

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

module.exports = {
  buscarProfissionalAtivo,
  buscarConfiguracao,
  criarConfiguracao,
  atualizarConfiguracao,
  marcarConfigurada,
  listarHorarios,
  salvarHorario,
  executarTransacao:
    db.executarTransacao,
};
