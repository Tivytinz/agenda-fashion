const db = require("../db/db");

async function listarPlanosAtivos(executor = db) {
  const resultado = await executor.query(`
    SELECT
      id,
      nome,
      slug,
      valor,
      capacidade_agendamentos,
      limite_profissionais,
      limite_servicos,
      destaque,
      ativo
    FROM planos
    WHERE ativo = TRUE
    ORDER BY valor ASC
  `);

  return resultado.rows;
}

async function buscarNegocioDonoAtivoPorUsuario(
  usuarioId,
  executor = db
) {
  const resultado = await executor.query(
    `
      SELECT n.id AS negocio_id
      FROM usuarios_negocios un
      INNER JOIN negocios n
        ON n.id = un.negocio_id
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      WHERE un.usuario_id = $1
        AND un.ativo = TRUE
        AND un.papel = 'dono'
        AND n.ativo = TRUE
        AND u.ativo = TRUE
      LIMIT 1
    `,
    [usuarioId]
  );

  return resultado.rows[0] || null;
}

async function bloquearUsoPlano(
  negocioId,
  executor
) {
  await executor.query(
    `
      SELECT pg_advisory_xact_lock(
        hashtext('agenda_fashion_limite_plano'),
        $1::integer
      )
    `,
    [Number(negocioId)]
  );
}

async function buscarUsoPlano(
  negocioId,
  dataReferencia = null,
  executor = db
) {
  const resultado = await executor.query(
    `
      SELECT
        n.id AS negocio_id,
        n.nome AS negocio_nome,
        p.id AS plano_id,
        p.nome AS plano_nome,
        p.slug AS plano_slug,
        p.valor,
        p.capacidade_agendamentos,
        p.limite_profissionais,
        p.limite_servicos,
        p.destaque,
        plano_selecionado.id AS plano_selecionado_id,
        plano_selecionado.nome AS plano_selecionado_nome,
        plano_selecionado.slug AS plano_selecionado_slug,
        plano_selecionado.valor AS plano_selecionado_valor,
        assinatura_ativa.id AS assinatura_ativa_id,
        (
          SELECT COUNT(*)::int
          FROM agendamentos a
          WHERE a.negocio_id = n.id
            AND a.status IN (
              'agendado',
              'confirmado',
              'realizado',
              'falta'
            )
            AND a.data >= date_trunc(
              'month',
              COALESCE($2::date, CURRENT_DATE)
            )
            AND a.data < date_trunc(
              'month',
              COALESCE($2::date, CURRENT_DATE)
            ) + INTERVAL '1 month'
        ) AS utilizados,
        (
          SELECT COUNT(*)::int
          FROM usuarios_negocios un
          WHERE un.negocio_id = n.id
            AND un.ativo = TRUE
            AND un.papel IN ('dono', 'profissional')
        ) AS profissionais_utilizados,
        (
          SELECT COUNT(*)::int
          FROM servicos_negocio sn
          WHERE sn.negocio_id = n.id
            AND sn.ativo = TRUE
        ) AS servicos_utilizados
      FROM negocios n
      INNER JOIN planos plano_selecionado
        ON plano_selecionado.id = n.plano_id
      LEFT JOIN LATERAL (
        SELECT a.id, a.plano_id
        FROM assinaturas a
        WHERE a.negocio_id = n.id
          AND a.ativo = TRUE
        ORDER BY a.id DESC
        LIMIT 1
      ) assinatura_ativa ON TRUE
      LEFT JOIN LATERAL (
        SELECT gratis.id
        FROM planos gratis
        WHERE gratis.slug = 'inicial'
          AND gratis.ativo = TRUE
        ORDER BY gratis.id ASC
        LIMIT 1
      ) plano_gratis ON TRUE
      INNER JOIN planos p
        ON p.id = COALESCE(
          assinatura_ativa.plano_id,
          CASE
            WHEN plano_selecionado.valor <= 0
              THEN plano_selecionado.id
            ELSE plano_gratis.id
          END
        )
      WHERE n.id = $1
      LIMIT 1
    `,
    [negocioId, dataReferencia]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  listarPlanosAtivos,
  buscarNegocioDonoAtivoPorUsuario,
  bloquearUsoPlano,
  buscarUsoPlano,
};
