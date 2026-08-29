const db = require(
  "../db/db"
);
const {
  periodoSeguro,
  filtroTimestamp,
} = require(
  "./adminProfessionalFunnelRepository"
);

async function buscarResumo(
  periodo = "30"
) {
  const periodoNormalizado =
    periodoSeguro(periodo);
  const filtroCoorte =
    filtroTimestamp(
      periodoNormalizado,
      "mua.atribuicao_em"
    );

  const resultado = await db.query(
    `
    WITH coorte AS (
      SELECT DISTINCT ON (mua.usuario_id)
        mua.usuario_id,
        mua.atribuicao_em
      FROM marketing_usuario_atribuicoes mua
      WHERE mua.intencao = 'profissional'
        ${filtroCoorte}
      ORDER BY
        mua.usuario_id,
        mua.atribuicao_em ASC
    ),

    negocios_coorte AS (
      SELECT
        c.usuario_id,
        c.atribuicao_em,
        dono.negocio_id
      FROM coorte c
      LEFT JOIN LATERAL (
        SELECT un.negocio_id
        FROM usuarios_negocios un
        WHERE un.usuario_id = c.usuario_id
          AND un.papel = 'dono'
        ORDER BY
          un.created_at ASC,
          un.id ASC
        LIMIT 1
      ) dono ON TRUE
    ),

    recorrencia AS (
      SELECT
        nc.usuario_id,
        nc.negocio_id,
        COUNT(ag.id)::INT
          AS total_agendamentos
      FROM negocios_coorte nc
      LEFT JOIN agendamentos ag
        ON ag.negocio_id = nc.negocio_id
      GROUP BY
        nc.usuario_id,
        nc.negocio_id
    )

    SELECT
      COUNT(*)::INT
        AS profissionais_coorte,
      COUNT(*) FILTER (
        WHERE negocio_id IS NOT NULL
      )::INT
        AS negocios_criados,
      COUNT(*) FILTER (
        WHERE total_agendamentos >= 1
      )::INT
        AS com_primeiro_agendamento,
      COUNT(*) FILTER (
        WHERE total_agendamentos >= 2
      )::INT
        AS com_segundo_agendamento,
      COUNT(*) FILTER (
        WHERE total_agendamentos >= 3
      )::INT
        AS com_terceiro_agendamento
    FROM recorrencia
    `
  );

  return {
    periodo: periodoNormalizado,
    resumo: resultado.rows[0] || {},
  };
}

module.exports = {
  buscarResumo,
};
