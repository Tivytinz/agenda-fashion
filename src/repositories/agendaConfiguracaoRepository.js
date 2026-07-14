const db = require("../db/db");

async function buscarConfiguracao(profissionalId) {
  const result = await db.query(
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
}) {
  const result = await db.query(
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
}) {
  const result = await db.query(
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

async function listarHorarios(profissionalId) {
  const result = await db.query(
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
}) {
  const result = await db.query(
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
  buscarConfiguracao,
  criarConfiguracao,
  atualizarConfiguracao,
  listarHorarios,
  salvarHorario
};