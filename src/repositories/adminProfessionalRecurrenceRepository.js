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
        mua.atribuicao_em,
        TO_CHAR(
          DATE_TRUNC(
            'week',
            u.created_at AT TIME ZONE 'America/Sao_Paulo'
          ),
          'YYYY-MM-DD'
        ) AS semana_cadastro
      FROM marketing_usuario_atribuicoes mua
      INNER JOIN usuarios u
        ON u.id = mua.usuario_id
      WHERE mua.intencao = 'profissional'
        ${filtroCoorte}
      ORDER BY
        mua.usuario_id,
        mua.atribuicao_em ASC
    )

    SELECT
      c.usuario_id,
      c.semana_cadastro,
      dono.negocio_id,
      COALESCE(
        recorrencia.total_agendamentos,
        0
      )::INT AS total_agendamentos,
      recorrencia.primeiro_agendamento_em,
      recorrencia.segundo_agendamento_em,
      recorrencia.terceiro_agendamento_em
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
    LEFT JOIN LATERAL (
      SELECT
        COUNT(ag.id)::INT
          AS total_agendamentos,
        (
          ARRAY_AGG(
            ag.created_at
            ORDER BY
              ag.created_at ASC,
              ag.id ASC
          )
        )[1] AS primeiro_agendamento_em,
        (
          ARRAY_AGG(
            ag.created_at
            ORDER BY
              ag.created_at ASC,
              ag.id ASC
          )
        )[2] AS segundo_agendamento_em,
        (
          ARRAY_AGG(
            ag.created_at
            ORDER BY
              ag.created_at ASC,
              ag.id ASC
          )
        )[3] AS terceiro_agendamento_em
      FROM agendamentos ag
      WHERE ag.negocio_id = dono.negocio_id
        AND ag.status <> 'cancelado'
    ) recorrencia ON TRUE
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
