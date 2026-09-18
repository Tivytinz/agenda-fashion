const db = require("../db/db");

async function buscarNegocioDono(
  usuarioId,
  executor = db
) {
  const result = await executor.query(
    `
      SELECT un.negocio_id
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      INNER JOIN negocios n
        ON n.id = un.negocio_id
        AND n.ativo = TRUE
      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
        AND un.ativo = TRUE
      LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarProfissionalAtivo(
  {
    negocioId,
    profissionalId,
  },
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        un.usuario_id AS id,
        COALESCE(
          un.nome_exibicao,
          u.nome
        ) AS nome,
        un.papel
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      WHERE un.negocio_id = $1
        AND un.usuario_id = $2
        AND un.ativo = TRUE
        AND un.papel IN (
          'dono',
          'profissional'
        )
      LIMIT 1
    `,
    [negocioId, profissionalId]
  );

  return result.rows[0] || null;
}

async function buscarServicoDoNegocio(
  {
    negocioId,
    servicoId,
  },
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        id,
        negocio_id,
        nome,
        ativo
      FROM servicos_negocio
      WHERE id = $1
        AND negocio_id = $2
      LIMIT 1
    `,
    [servicoId, negocioId]
  );

  return result.rows[0] || null;
}

async function listarServicosComElegibilidade(
  {
    negocioId,
    profissionalId,
  },
  executor = db
) {
  const result = await executor.query(
    `
      SELECT
        s.id,
        s.nome,
        s.ativo,
        EXISTS (
          SELECT 1
          FROM servicos_profissionais sp
          WHERE sp.negocio_id = s.negocio_id
            AND sp.servico_id = s.id
            AND sp.profissional_id = $2
        ) AS habilitada
      FROM servicos_negocio s
      WHERE s.negocio_id = $1
      ORDER BY
        s.ativo DESC,
        s.nome ASC,
        s.id ASC
    `,
    [negocioId, profissionalId]
  );

  return result.rows;
}

async function substituirElegibilidade({
  negocioId,
  profissionalId,
  servicoIds,
  actorUserId,
  executor = db,
}) {
  await executor.query(
    `
      SELECT id
      FROM usuarios_negocios
      WHERE negocio_id = $1
        AND usuario_id = $2
      LIMIT 1
      FOR UPDATE
    `,
    [negocioId, profissionalId]
  );

  await executor.query(
    `
      DELETE FROM servicos_profissionais
      WHERE negocio_id = $1
        AND profissional_id = $2
    `,
    [negocioId, profissionalId]
  );

  if (!servicoIds.length) {
    return [];
  }

  const result = await executor.query(
    `
      INSERT INTO servicos_profissionais (
        negocio_id,
        servico_id,
        profissional_id,
        created_by_user_id
      )
      SELECT
        $1,
        s.id,
        $2,
        $4
      FROM servicos_negocio s
      WHERE s.negocio_id = $1
        AND s.id = ANY($3::BIGINT[])
      ON CONFLICT (
        servico_id,
        profissional_id
      )
      DO UPDATE SET
        negocio_id = EXCLUDED.negocio_id,
        created_by_user_id =
          EXCLUDED.created_by_user_id
      RETURNING servico_id
    `,
    [
      negocioId,
      profissionalId,
      servicoIds,
      actorUserId,
    ]
  );

  return result.rows.map(
    (item) => Number(item.servico_id)
  );
}

async function profissionalElegivelParaServico(
  {
    negocioId,
    profissionalId,
    servicoId,
  },
  executor = db
) {
  const result = await executor.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM servicos_profissionais sp
        INNER JOIN servicos_negocio s
          ON s.id = sp.servico_id
          AND s.negocio_id = sp.negocio_id
          AND s.ativo = TRUE
        INNER JOIN usuarios_negocios un
          ON un.negocio_id = sp.negocio_id
          AND un.usuario_id = sp.profissional_id
          AND un.ativo = TRUE
          AND un.papel IN ('dono', 'profissional')
        INNER JOIN usuarios u
          ON u.id = sp.profissional_id
          AND u.ativo = TRUE
        WHERE sp.negocio_id = $1
          AND sp.profissional_id = $2
          AND sp.servico_id = $3
      ) AS elegivel
    `,
    [
      negocioId,
      profissionalId,
      servicoId,
    ]
  );

  return result.rows[0]?.elegivel === true;
}

module.exports = {
  buscarNegocioDono,
  buscarProfissionalAtivo,
  buscarServicoDoNegocio,
  listarServicosComElegibilidade,
  substituirElegibilidade,
  profissionalElegivelParaServico,
};
