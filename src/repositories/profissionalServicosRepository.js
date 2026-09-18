const db = require("../db/db");

async function buscarVinculoAtivoProfissional({
  negocioId,
  profissionalId,
  executor = db,
  bloquear = false,
}) {
  const lock = bloquear
    ? "FOR UPDATE OF un"
    : "";

  const result = await executor.query(
    `
      SELECT
        un.id,
        un.usuario_id,
        un.negocio_id,
        un.papel
      FROM usuarios_negocios un
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
        AND u.ativo = TRUE
      INNER JOIN negocios n
        ON n.id = un.negocio_id
        AND n.ativo = TRUE
      WHERE un.negocio_id = $1
        AND un.usuario_id = $2
        AND un.ativo = TRUE
        AND un.papel IN ('dono', 'profissional')
      LIMIT 1
      ${lock}
    `,
    [negocioId, profissionalId]
  );

  return result.rows[0] || null;
}

async function listarServicosProfissional({
  negocioId,
  profissionalId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT
        s.id,
        s.nome,
        s.ativo,
        EXISTS (
          SELECT 1
          FROM profissional_servicos ps
          WHERE ps.negocio_id = s.negocio_id
            AND ps.profissional_id = $2
            AND ps.servico_id = s.id
        ) AS habilitado
      FROM servicos_negocio s
      WHERE s.negocio_id = $1
      ORDER BY s.ativo DESC, s.nome ASC, s.id ASC
    `,
    [negocioId, profissionalId]
  );

  return result.rows;
}

async function substituirServicosProfissional({
  negocioId,
  profissionalId,
  servicoIds,
  habilitadoPorUsuarioId,
  executor = db,
}) {
  await executor.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext('profissional_servicos'),
        $1::integer
      )
    `,
    [Number(negocioId)]
  );

  const ids = Array.from(
    new Set(
      (servicoIds || [])
        .map(Number)
        .filter(
          (id) =>
            Number.isInteger(id) &&
            id > 0
        )
    )
  );

  if (ids.length > 0) {
    const validacao = await executor.query(
      `
        SELECT COUNT(*)::int AS total
        FROM servicos_negocio
        WHERE negocio_id = $1
          AND id = ANY($2::BIGINT[])
      `,
      [negocioId, ids]
    );

    if (
      Number(validacao.rows[0]?.total || 0) !==
      ids.length
    ) {
      const erro = new Error(
        "Um ou mais serviços não pertencem a este negócio."
      );
      erro.status = 400;
      erro.statusCode = 400;
      throw erro;
    }
  }

  await executor.query(
    `
      DELETE FROM profissional_servicos
      WHERE negocio_id = $1
        AND profissional_id = $2
    `,
    [negocioId, profissionalId]
  );

  if (ids.length === 0) {
    return [];
  }

  const result = await executor.query(
    `
      INSERT INTO profissional_servicos (
        negocio_id,
        profissional_id,
        servico_id,
        habilitado_por_usuario_id
      )
      SELECT
        $1,
        $2,
        servico_id,
        $4
      FROM UNNEST($3::BIGINT[]) AS servico_id
      ON CONFLICT (
        negocio_id,
        profissional_id,
        servico_id
      )
      DO UPDATE SET
        habilitado_por_usuario_id =
          EXCLUDED.habilitado_por_usuario_id,
        habilitado_em = NOW()
      RETURNING
        negocio_id,
        profissional_id,
        servico_id,
        habilitado_em
    `,
    [
      negocioId,
      profissionalId,
      ids,
      habilitadoPorUsuarioId,
    ]
  );

  return result.rows;
}

async function habilitarServicoProfissional({
  negocioId,
  profissionalId,
  servicoId,
  habilitadoPorUsuarioId,
  executor = db,
}) {
  const result = await executor.query(
    `
      INSERT INTO profissional_servicos (
        negocio_id,
        profissional_id,
        servico_id,
        habilitado_por_usuario_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (
        negocio_id,
        profissional_id,
        servico_id
      )
      DO UPDATE SET
        habilitado_por_usuario_id =
          EXCLUDED.habilitado_por_usuario_id,
        habilitado_em = NOW()
      RETURNING
        negocio_id,
        profissional_id,
        servico_id,
        habilitado_em
    `,
    [
      negocioId,
      profissionalId,
      servicoId,
      habilitadoPorUsuarioId,
    ]
  );

  return result.rows[0] || null;
}

async function profissionalEstaElegivel({
  negocioId,
  profissionalId,
  servicoId,
  executor = db,
}) {
  const result = await executor.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM profissional_servicos ps
        INNER JOIN usuarios_negocios un
          ON un.negocio_id = ps.negocio_id
          AND un.usuario_id = ps.profissional_id
          AND un.ativo = TRUE
          AND un.papel IN ('dono', 'profissional')
        INNER JOIN usuarios u
          ON u.id = ps.profissional_id
          AND u.ativo = TRUE
        INNER JOIN servicos_negocio s
          ON s.id = ps.servico_id
          AND s.negocio_id = ps.negocio_id
          AND s.ativo = TRUE
        WHERE ps.negocio_id = $1
          AND ps.profissional_id = $2
          AND ps.servico_id = $3
      ) AS elegivel
    `,
    [negocioId, profissionalId, servicoId]
  );

  return result.rows[0]?.elegivel === true;
}

module.exports = {
  buscarVinculoAtivoProfissional,
  listarServicosProfissional,
  substituirServicosProfissional,
  habilitarServicoProfissional,
  profissionalEstaElegivel,
};
