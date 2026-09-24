const db = require("../db/db");

function normalizeSearch(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeStatus(value) {
  const text = String(value || "").trim();
  return text || null;
}

async function listarUsuarios({
  busca,
  status,
  limite,
  offset
}) {
  const search = normalizeSearch(busca);
  const normalizedStatus = normalizeStatus(status);
  const where = `
    WHERE (
      $1::TEXT IS NULL OR
      CONCAT_WS(
        ' ',
        u.nome,
        u.email,
        COALESCE(ua.papel, '')
      ) ILIKE '%' || $1 || '%'
    )
      AND (
        $2::TEXT IS NULL OR
        (
          $2 = 'ativo'
          AND u.ativo = TRUE
          AND u.encerrado_definitivo_em IS NULL
        ) OR
        (
          $2 = 'desativado'
          AND u.ativo = FALSE
          AND u.encerrado_definitivo_em IS NULL
        ) OR
        (
          $2 = 'encerrado'
          AND u.encerrado_definitivo_em IS NOT NULL
        )
      )
  `;

  const [countResult, dataResult] = await Promise.all([
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM usuarios u
        LEFT JOIN usuarios_administradores ua
          ON ua.usuario_id = u.id
          AND ua.ativo = TRUE
        ${where}
      `,
      [search, normalizedStatus]
    ),
    db.query(
      `
        SELECT
          u.id,
          u.nome,
          u.email,
          u.ativo,
          u.desativado_em,
          u.encerrado_definitivo_em,
          u.email_verificado_em,
          u.ultimo_login_em,
          u.perfil_profissional_ativado_em,
          u.created_at,
          u.updated_at,
          ua.papel AS papel_admin,
          ARRAY(
            SELECT DISTINCT un.papel
            FROM usuarios_negocios un
            WHERE un.usuario_id = u.id
              AND un.ativo = TRUE
            ORDER BY un.papel
          ) AS papeis_negocio,
          COALESCE((
            SELECT COUNT(DISTINCT un.negocio_id)::INT
            FROM usuarios_negocios un
            INNER JOIN negocios n
              ON n.id = un.negocio_id
            WHERE un.usuario_id = u.id
              AND un.ativo = TRUE
              AND n.ativo = TRUE
              AND n.arquivado_em IS NULL
          ), 0) AS total_negocios_ativos
        FROM usuarios u
        LEFT JOIN usuarios_administradores ua
          ON ua.usuario_id = u.id
          AND ua.ativo = TRUE
        ${where}
        ORDER BY u.created_at DESC, u.id DESC
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

async function listarNegocios({
  busca,
  status,
  limite,
  offset
}) {
  const search = normalizeSearch(busca);
  const normalizedStatus = normalizeStatus(status);
  const where = `
    WHERE (
      $1::TEXT IS NULL OR
      CONCAT_WS(
        ' ',
        n.nome,
        n.cidade,
        n.bairro,
        n.setor,
        COALESCE(dono.nome, ''),
        COALESCE(p.nome, '')
      ) ILIKE '%' || $1 || '%'
    )
      AND (
        $2::TEXT IS NULL OR
        (
          $2 = 'publicado'
          AND n.ativo = TRUE
          AND n.publicado = TRUE
          AND n.arquivado_em IS NULL
        ) OR
        (
          $2 = 'despublicado'
          AND n.ativo = TRUE
          AND n.publicado = FALSE
          AND n.despublicado_manual_em IS NOT NULL
          AND n.arquivado_em IS NULL
        ) OR
        (
          $2 = 'rascunho'
          AND n.ativo = TRUE
          AND n.publicado = FALSE
          AND n.despublicado_manual_em IS NULL
          AND n.arquivado_em IS NULL
        ) OR
        (
          $2 = 'inativo'
          AND n.ativo = FALSE
          AND n.arquivado_em IS NULL
        ) OR
        (
          $2 = 'arquivado'
          AND n.arquivado_em IS NOT NULL
        )
      )
  `;

  const joins = `
    LEFT JOIN planos p
      ON p.id = n.plano_id
    LEFT JOIN LATERAL (
      SELECT
        u.id,
        u.nome
      FROM usuarios_negocios un_dono
      INNER JOIN usuarios u
        ON u.id = un_dono.usuario_id
      WHERE un_dono.negocio_id = n.id
        AND un_dono.papel = 'dono'
      ORDER BY
        un_dono.ativo DESC,
        un_dono.created_at ASC,
        un_dono.id ASC
      LIMIT 1
    ) dono ON TRUE
  `;

  const [countResult, dataResult] = await Promise.all([
    db.query(
      `
        SELECT COUNT(*)::INT AS total
        FROM negocios n
        ${joins}
        ${where}
      `,
      [search, normalizedStatus]
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
          COALESCE(n.publicado, FALSE) AS publicado,
          n.despublicado_manual_em,
          n.arquivado_em,
          n.motivo_arquivamento,
          n.created_at,
          n.updated_at,
          p.id AS plano_id,
          p.nome AS plano_nome,
          p.slug AS plano_slug,
          dono.id AS dono_id,
          dono.nome AS dono_nome,
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
        ${joins}
        ${where}
        ORDER BY n.created_at DESC, n.id DESC
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

async function listarAgendamentos({
  busca,
  status,
  limite,
  offset
}) {
  const search = normalizeSearch(busca);
  const normalizedStatus = normalizeStatus(status);
  const where = `
    WHERE (
      $1::TEXT IS NULL OR
      CONCAT_WS(
        ' ',
        COALESCE(
          NULLIF(BTRIM(c.nome), ''),
          NULLIF(BTRIM(a.cliente_nome), '')
        ),
        n.nome,
        COALESCE(a.servico_nome, s.nome),
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
          a.inicio_previsto_em,
          a.status_atendimento_em,
          a.status_atendimento_por,
          status_ator.nome AS status_atendimento_por_nome,
          a.cancelado_por,
          a.cancelamento_origem,
          a.motivo_cancelamento,
          a.duracao_minutos,
          a.antecedencia_cancelamento_horas,
          a.cliente_id,
          COALESCE(
            NULLIF(BTRIM(c.nome), ''),
            NULLIF(BTRIM(a.cliente_nome), ''),
            'Cliente não informado'
          ) AS cliente_nome,
          n.id AS negocio_id,
          n.nome AS negocio,
          s.id AS servico_id,
          COALESCE(
            NULLIF(BTRIM(a.servico_nome), ''),
            NULLIF(BTRIM(s.nome), ''),
            'Serviço'
          ) AS servico,
          COALESCE(a.valor_servico, s.valor, 0)::NUMERIC AS valor,
          p.id AS profissional_id,
          p.nome AS profissional,
          a.created_at
        FROM agendamentos a
        LEFT JOIN usuarios c ON c.id = a.cliente_id
        LEFT JOIN usuarios p ON p.id = a.profissional_id
        LEFT JOIN usuarios status_ator
          ON status_ator.id = a.status_atendimento_por
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
  listarUsuarios,
  listarNegocios,
  listarAgendamentos
};
