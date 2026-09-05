const db = require("../db/db");

function normalizeSearch(value) {
  const text = String(value || "").trim();
  return text || null;
}

async function listarNegocios({ busca, limite, offset }) {
  const search = normalizeSearch(busca);

  const [countResult, dataResult] = await Promise.all([
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM negocios n
        WHERE (
          $1::TEXT IS NULL OR
          CONCAT_WS(' ', n.nome, n.cidade, n.bairro, n.setor) ILIKE '%' || $1 || '%'
        )
      `,
      [search]
    ),
    db.query(
      `
        SELECT
          n.id,
          n.nome,
          n.slug,
          n.cidade,
          n.bairro,
          n.setor,
          n.whatsapp,
          n.foto_url,
          COALESCE(n.ativo, TRUE) AS ativo,
          n.created_at,
          n.updated_at,
          COALESCE((
            SELECT COUNT(*)::INT
            FROM usuarios_negocios un
            INNER JOIN usuarios u
              ON u.id = un.usuario_id
              AND u.ativo = TRUE
            WHERE un.negocio_id = n.id
              AND un.ativo = TRUE
              AND un.papel IN ('dono', 'profissional')
          ), 0) AS total_profissionais,
          COALESCE((
            SELECT COUNT(*)::INT
            FROM servicos_negocio s
            WHERE s.negocio_id = n.id
          ), 0) AS total_servicos,
          COALESCE((
            SELECT COUNT(*)::INT
            FROM agendamentos a
            WHERE a.negocio_id = n.id
              AND COALESCE(a.status, 'agendado') <> 'cancelado'
          ), 0) AS total_agendamentos
        FROM negocios n
        WHERE (
          $1::TEXT IS NULL OR
          CONCAT_WS(' ', n.nome, n.cidade, n.bairro, n.setor) ILIKE '%' || $1 || '%'
        )
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT $2 OFFSET $3
      `,
      [search, limite, offset]
    )
  ]);

  return {
    rows: dataResult.rows,
    total: Number(countResult.rows?.[0]?.total || 0)
  };
}

async function listarAgendamentos({ busca, status, limite, offset }) {
  const search = normalizeSearch(busca);
  const normalizedStatus = normalizeSearch(status);
  const where = `
    WHERE (
      $1::TEXT IS NULL OR
      CONCAT_WS(
        ' ',
        COALESCE(c.nome, a.cliente_nome),
        n.nome,
        s.nome,
        p.nome,
        COALESCE(a.status, 'agendado')
      ) ILIKE '%' || $1 || '%'
    )
      AND (
        $2::TEXT IS NULL OR
        COALESCE(a.status, 'agendado') = $2
      )
  `;

  const [countResult, dataResult] = await Promise.all([
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM agendamentos a
        LEFT JOIN usuarios c ON c.id = a.cliente_id
        LEFT JOIN usuarios p ON p.id = a.profissional_id
        LEFT JOIN servicos_negocio s ON s.id = a.servico_id
        LEFT JOIN negocios n ON n.id = COALESCE(a.negocio_id, s.negocio_id)
        ${where}
      `,
      [search, normalizedStatus]
    ),
    db.query(
      `
        SELECT
          a.id,
          TO_CHAR(a.data, 'YYYY-MM-DD') AS data,
          TO_CHAR(a.horario::TIME, 'HH24:MI') AS horario,
          COALESCE(a.status, 'agendado') AS status,
          a.cliente_id,
          COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), ''),
            'Cliente não informado'
          ) AS cliente_nome,
          n.id AS negocio_id,
          n.nome AS negocio,
          s.id AS servico_id,
          s.nome AS servico,
          COALESCE(a.valor_servico, s.valor, 0)::NUMERIC AS valor,
          p.id AS profissional_id,
          p.nome AS profissional,
          a.created_at
        FROM agendamentos a
        LEFT JOIN usuarios c ON c.id = a.cliente_id
        LEFT JOIN usuarios p ON p.id = a.profissional_id
        LEFT JOIN servicos_negocio s ON s.id = a.servico_id
        LEFT JOIN negocios n ON n.id = COALESCE(a.negocio_id, s.negocio_id)
        ${where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $3 OFFSET $4
      `,
      [search, normalizedStatus, limite, offset]
    )
  ]);

  return {
    rows: dataResult.rows,
    total: Number(countResult.rows?.[0]?.total || 0)
  };
}

module.exports = {
  listarNegocios,
  listarAgendamentos
};
