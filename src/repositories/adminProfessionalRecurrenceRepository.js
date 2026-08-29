const db = require(
  "../db/db"
);
const {
  periodoSeguro,
  filtroTimestamp,
} = require(
  "./adminProfessionalFunnelRepository"
);
const {
  campanhaAusenteSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
} = require(
  "./marketingAttributionSql"
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
  const atribuicao =
    criarAtribuicaoUsuarioSql(
      "mua"
    );
  const vinculoCampanha =
    criarVinculoCampanhaOficialSql({
      origem: "a.origem",
      midia: "a.midia",
      campanha: "a.campanha",
      momento: "a.atribuicao_em",
      objetivo: "profissional",
    });
  const campanhaAusente =
    campanhaAusenteSql(
      "a.campanha"
    );

  const resultado = await db.query(
    `
    WITH atribuicoes_resolvidas AS (
      SELECT
        mua.usuario_id,
        mua.atribuicao_em,
        ${atribuicao.atribuicaoPaga}
          AS pago,
        ${atribuicao.atribuicaoRastreada}
          AS rastreado,
        ${atribuicao.trafegoOrganico}
          AS organico,
        ${atribuicao.origem}
          AS origem,
        ${atribuicao.midia}
          AS midia,
        ${atribuicao.campanha}
          AS campanha
      FROM marketing_usuario_atribuicoes mua
      WHERE mua.intencao = 'profissional'
        ${filtroCoorte}
    ),

    atribuicoes_classificadas AS (
      SELECT
        a.usuario_id,
        a.atribuicao_em,
        COALESCE(
          campanha_oficial.utm_source,
          a.origem
        ) AS origem,
        COALESCE(
          campanha_oficial.utm_medium,
          a.midia
        ) AS midia,
        COALESCE(
          campanha_oficial.utm_campaign,
          a.campanha
        ) AS campanha,
        campanha_oficial.id
          AS campanha_oficial_id,
        campanha_oficial.metodo_resolucao,
        CASE
          WHEN campanha_oficial.id IS NOT NULL
            THEN 'oficial'
          WHEN a.pago AND ${campanhaAusente}
            THEN 'rastreamento_incompleto'
          WHEN a.pago
            THEN 'identidade_nao_oficial'
          WHEN NOT a.rastreado
            THEN 'sem_evidencia'
          WHEN a.organico
            THEN 'organico'
          ELSE 'sem_evidencia'
        END AS classificacao_atribuicao
      FROM atribuicoes_resolvidas a
      ${vinculoCampanha}
    ),

    coorte AS (
      SELECT DISTINCT ON (a.usuario_id)
        a.usuario_id,
        a.atribuicao_em,
        a.origem,
        a.midia,
        a.campanha,
        a.campanha_oficial_id,
        a.metodo_resolucao,
        a.classificacao_atribuicao,
        TO_CHAR(
          DATE_TRUNC(
            'week',
            u.created_at AT TIME ZONE 'America/Sao_Paulo'
          ),
          'YYYY-MM-DD'
        ) AS semana_cadastro
      FROM atribuicoes_classificadas a
      INNER JOIN usuarios u
        ON u.id = a.usuario_id
      ORDER BY
        a.usuario_id,
        a.atribuicao_em ASC
    )

    SELECT
      c.usuario_id,
      c.semana_cadastro,
      c.origem,
      c.midia,
      c.campanha,
      c.campanha_oficial_id,
      c.metodo_resolucao,
      c.classificacao_atribuicao,
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
