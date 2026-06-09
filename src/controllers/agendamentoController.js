const db = require("../db");

// =========================
// LISTAR AGENDA
// =========================
const listarAgendaProfissional = async (req, res) => {
  try {
    const profissionalId = req.user?.id;

    if (!profissionalId) {
      return res.status(401).json({ erro: "Usuário não autenticado" });
    }

    const { rows } = await db.query(`
      SELECT
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario, 'HH24:MI') AS hora,
        'agendado' AS status,
        u.nome AS cliente,
        s.nome AS servico,
        s.valor AS valor
      FROM agendamentos a
      LEFT JOIN usuarios u ON u.id = a.cliente_id
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.profissional_id = $1
        AND a.status IN ('agendado', 'confirmado')
        AND a.data BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'

      UNION ALL

      SELECT
        TO_CHAR(b.data_bloqueio, 'YYYY-MM-DD') AS data,
        TO_CHAR(b.hora_bloqueio, 'HH24:MI') AS hora,
        'bloqueado' AS status,
        NULL AS cliente,
        NULL AS servico,
        NULL AS valor
      FROM bloqueios_horarios b
      WHERE b.profissional_id = $1
        AND b.data_bloqueio BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'

      ORDER BY data, hora
    `, [profissionalId]);

    return res.json(rows);

  } catch (erro) {
    console.error("Erro ao listar agenda:", erro);
    return res.status(500).json({ erro: "Erro ao listar agenda" });
  }
};



// =========================
// BLOQUEAR / DESBLOQUEAR
// =========================
const alternarBloqueioHorario = async (req, res) => {
  try {
    const profissionalId = req.user?.id;
    const { data, hora } = req.body;

    if (!profissionalId) {
      return res.status(401).json({ erro: "Usuário não autenticado" });
    }

    if (!data || !hora) {
      return res.status(400).json({ erro: "Data e hora obrigatórios" });
    }

    // 🔒 NÃO deixa bloquear se já tiver agendamento
    const existeAgendamento = await db.query(`
      SELECT id FROM agendamentos
      WHERE profissional_id = $1
      AND data = $2
      AND TO_CHAR(horario, 'HH24:MI') = $3
      LIMIT 1
    `, [profissionalId, data, hora]);

    if (existeAgendamento.rows.length > 0) {
      return res.status(400).json({ erro: "Horário já está agendado" });
    }

    // 🔄 alterna bloqueio
    const existeBloqueio = await db.query(`
      SELECT id FROM bloqueios_horarios
      WHERE profissional_id = $1
      AND data_bloqueio = $2
      AND hora_bloqueio = $3
      LIMIT 1
    `, [profissionalId, data, hora]);

    if (existeBloqueio.rows.length > 0) {
      await db.query(
        `DELETE FROM bloqueios_horarios WHERE id = $1`,
        [existeBloqueio.rows[0].id]
      );
    } else {
      await db.query(`
        INSERT INTO bloqueios_horarios (profissional_id, data_bloqueio, hora_bloqueio)
        VALUES ($1, $2, $3)
      `, [profissionalId, data, hora]);
    }

    // 🔁 RETORNA AGENDA ATUALIZADA
    const agendaAtualizada = await db.query(`
      SELECT
        TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
        TO_CHAR(a.horario, 'HH24:MI') AS hora,
        'agendado' AS status,
        u.nome AS cliente,
        s.nome AS servico,
        s.valor AS valor
      FROM agendamentos a
      LEFT JOIN usuarios u ON u.id = a.cliente_id
      LEFT JOIN servicos_negocio s ON s.id = a.servico_id
      WHERE a.profissional_id = $1
        AND a.status IN ('agendado', 'confirmado')
        AND a.data BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'

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
        AND b.data_bloqueio BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '6 days'

      ORDER BY data, hora
    `, [profissionalId]);

    return res.json({
      sucesso: true,
      agenda: agendaAtualizada.rows
    });

  } catch (erro) {
    console.error("Erro ao alternar bloqueio:", erro);
    return res.status(500).json({
      erro: "Erro ao alternar bloqueio"
    });
  }
};

module.exports = {
  listarAgendaProfissional,
  alternarBloqueioHorario
};