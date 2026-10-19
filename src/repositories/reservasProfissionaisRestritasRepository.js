const db = require("../db/db");
const { VINCULO_RESTRITO_SQL } = require("./reservasProfissionaisRestritasSql");

async function listar({ usuarioId, limite, offset }) {
  const result = await db.query(`
    SELECT a.id, a.negocio_id, n.nome AS negocio,
      TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
      TO_CHAR(a.horario, 'HH24:MI') AS horario,
      a.status,
      COALESCE(NULLIF(BTRIM(a.cliente_nome), ''), c.nome, 'Cliente') AS cliente,
      COALESCE(NULLIF(BTRIM(a.servico_nome), ''), s.nome, 'Serviço') AS servico,
      a.status IN ('agendado', 'confirmado')
        AND COALESCE(a.inicio_previsto_em,
          (a.data + a.horario) AT TIME ZONE COALESCE(NULLIF(n.fuso_horario, ''), 'America/Sao_Paulo'))
          + make_interval(mins => COALESCE(a.duracao_minutos, s.duracao_minutos, 0)) <= NOW()
        AS pode_marcar_realizado,
      a.status IN ('agendado', 'confirmado')
        AND a.atendimento_iniciado_em IS NULL
        AND COALESCE(a.inicio_previsto_em,
          (a.data + a.horario) AT TIME ZONE COALESCE(NULLIF(n.fuso_horario, ''), 'America/Sao_Paulo'))
          + INTERVAL '15 minutes' <= NOW() AS pode_marcar_falta
    FROM agendamentos a
    INNER JOIN usuarios_negocios un ON un.negocio_id = a.negocio_id AND un.usuario_id = $1
    INNER JOIN usuarios u ON u.id = un.usuario_id
    INNER JOIN negocios n ON n.id = a.negocio_id
    LEFT JOIN usuarios c ON c.id = a.cliente_id
    LEFT JOIN servicos_negocio s ON s.id = a.servico_id AND s.negocio_id = a.negocio_id
    WHERE ${VINCULO_RESTRITO_SQL}
    ORDER BY CASE WHEN a.status IN ('agendado', 'confirmado') THEN 0 ELSE 1 END,
      a.inicio_previsto_em DESC NULLS LAST, a.data DESC, a.horario DESC, a.id DESC
    LIMIT $2 OFFSET $3
  `, [usuarioId, limite, offset]);
  return result.rows;
}

module.exports = { listar };
