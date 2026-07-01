const db = require("../db");

async function listarAgendaProfissional(profissionalId) {
  const { rows } = await db.query(
    `
    SELECT
      TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
      TO_CHAR(a.horario, 'HH24:MI') AS hora,
      'agendado' AS status,
      u.nome AS cliente,
      s.nome AS servico,
      s.valor AS valor
    FROM agendamentos a
    LEFT JOIN usuarios u
      ON u.id = a.cliente_id
    LEFT JOIN servicos_negocio s
      ON s.id = a.servico_id
    WHERE a.profissional_id = $1
      AND a.status IN ('agendado', 'confirmado')
      AND a.data BETWEEN CURRENT_DATE
      AND CURRENT_DATE + INTERVAL '6 days'

    UNION ALL

    SELECT
      TO_CHAR(b.data_bloqueio, 'YYYY-MM-DD') AS data,
      TO_CHAR(b.hora_bloqueio, 'HH24:MI') AS hora,
      'bloqueado' AS status,
      NULL,
      NULL,
      NULL
    FROM bloqueios_horarios b
    WHERE b.profissional_id = $1
      AND b.data_bloqueio BETWEEN CURRENT_DATE
      AND CURRENT_DATE + INTERVAL '6 days'

    ORDER BY data, hora
    `,
    [profissionalId]
  );

  return rows;
}

async function buscarAgendamento(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM agendamentos
    WHERE profissional_id = $1
      AND data = $2
      AND TO_CHAR(horario,'HH24:MI') = $3
      AND status IN ('agendado','confirmado')
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function buscarBloqueio(profissionalId, data, hora) {
  const result = await db.query(
    `
    SELECT id
    FROM bloqueios_horarios
    WHERE profissional_id = $1
      AND data_bloqueio = $2
      AND TO_CHAR(hora_bloqueio,'HH24:MI') = $3
    LIMIT 1
    `,
    [profissionalId, data, hora]
  );

  return result.rows[0] || null;
}

async function removerBloqueio(id) {
  await db.query(
    `
    DELETE FROM bloqueios_horarios
    WHERE id = $1
    `,
    [id]
  );
}

async function criarBloqueio(profissionalId, data, hora) {
  await db.query(
    `
    INSERT INTO bloqueios_horarios(
      profissional_id,
      data_bloqueio,
      hora_bloqueio
    )
    VALUES($1,$2,$3)
    `,
    [profissionalId, data, hora]
  );
}

module.exports = {
  listarAgendaProfissional,
  buscarAgendamento,
  buscarBloqueio,
  removerBloqueio,
  criarBloqueio
};