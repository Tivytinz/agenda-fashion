const db = require(
  "../db/db"
);
const {
  periodoSeguro,
  filtroTimestamp,
} = require(
  "./adminProfessionalFunnelRepository"
);

async function listarRecorrencia(
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
    )

    SELECT
      c.usuario_id,
      dono.negocio_id,
      COUNT(ag.id)::INT
        AS total_agendamentos
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
    LEFT JOIN agendamentos ag
      ON ag.negocio_id = dono.negocio_id
      AND ag.status <> 'cancelado'
    GROUP BY
      c.usuario_id,
      dono.negocio_id
    ORDER BY c.usuario_id ASC
    `
  );

  return {
    periodo: periodoNormalizado,
    linhas: resultado.rows,
  };
}

module.exports = {
  listarRecorrencia,
};
