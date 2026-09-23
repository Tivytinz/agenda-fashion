const db = require("../db/db");
const {
  campanhaAusenteSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
} = require("./marketingAttributionSql");

function limiteSeguro(valor) {
  const limite = Number(valor);

  if (
    !Number.isInteger(limite) ||
    limite < 1 ||
    limite > 500
  ) {
    return 100;
  }

  return limite;
}

async function listarConversoesPendentes(
  limite = 100
) {
  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'aquisicao_financeira_v1_inicio'
      LIMIT 1
    ),
    conversoes AS (
      SELECT DISTINCT ON (ae.negocio_id)
        ae.id AS evento_id,
        ae.negocio_id,
        ae.ocorrido_em
      FROM assinatura_eventos ae
      INNER JOIN pagamentos pg
        ON pg.id = ae.pagamento_id
      CROSS JOIN marco m
      WHERE ae.tipo = 'CONVERSAO_INICIAL'
        AND ae.ocorrido_em >= m.ocorrido_em
        AND pg.data_pagamento IS NOT NULL
      ORDER BY
        ae.negocio_id,
        ae.ocorrido_em ASC,
        ae.id ASC
    )
    SELECT
      c.evento_id,
      c.negocio_id,
      c.ocorrido_em
    FROM conversoes c
    LEFT JOIN marketing_negocio_aquisicoes mna
      ON mna.negocio_id = c.negocio_id
    WHERE mna.id IS NULL
    ORDER BY
      c.ocorrido_em ASC,
      c.evento_id ASC
    LIMIT $1
    `,
    [limiteSeguro(limite)]
  );

  return resultado.rows;
}

async function materializarAquisicaoPorEvento(
  eventoId,
  executor = db
) {
  const atribuicao =
    criarAtribuicaoUsuarioSql("mua");
  const campanhaAusente =
    campanhaAusenteSql(
      "contexto.campanha_resolvida"
    );
  const vinculoCampanha =
    criarVinculoCampanhaOficialSql({
      origem:
        "contexto.origem_resolvida",
      midia:
        "contexto.midia_resolvida",
      campanha:
        "contexto.campanha_resolvida",
      momento:
        "contexto.atribuicao_em",
      alias:
        "campanha_oficial",
      objetivo:
        "profissional",
    });

  const resultado = await executor.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'aquisicao_financeira_v1_inicio'
      LIMIT 1
    ),
    evento AS (
      SELECT
        ae.id AS evento_id,
        ae.negocio_id,
        ae.pagamento_id,
        ae.plano_novo_id,
        ae.ocorrido_em,
        pg.data_pagamento
      FROM assinatura_eventos ae
      INNER JOIN pagamentos pg
        ON pg.id = ae.pagamento_id
      CROSS JOIN marco m
      WHERE ae.id = $1
        AND ae.tipo = 'CONVERSAO_INICIAL'
        AND ae.ocorrido_em >= m.ocorrido_em
        AND pg.data_pagamento IS NOT NULL
      LIMIT 1
    ),
    dono AS (
      SELECT
        un.negocio_id,
        un.usuario_id
      FROM usuarios_negocios un
      INNER JOIN evento e
        ON e.negocio_id = un.negocio_id
      WHERE un.papel = 'dono'
      ORDER BY
        un.created_at ASC,
        un.id ASC
      LIMIT 1
    ),
    base AS (
      SELECT
        e.evento_id,
        e.negocio_id,
        e.pagamento_id,
        e.plano_novo_id,
        e.ocorrido_em
          AS primeira_conversao_em,
        e.data_pagamento
          AS primeira_conversao_data,
        d.usuario_id
          AS usuario_aquisicao_id,
        mua.atribuicao_em
          AS atribuicao_em,
        mua.usuario_id IS NOT NULL
          AS tem_atribuicao,
        ${atribuicao.atribuicaoPaga}
          AS atribuicao_paga,
        ${atribuicao.atribuicaoRastreada}
          AS atribuicao_rastreada,
        ${atribuicao.trafegoOrganico}
          AS trafego_organico,
        ${atribuicao.origem}
          AS origem_resolvida,
        ${atribuicao.midia}
          AS midia_resolvida,
        ${atribuicao.campanha}
          AS campanha_resolvida
      FROM evento e
      INNER JOIN negocios n
        ON n.id = e.negocio_id
      LEFT JOIN dono d
        ON d.negocio_id = e.negocio_id
      LEFT JOIN usuarios u
        ON u.id = d.usuario_id
      LEFT JOIN marketing_usuario_atribuicoes mua
        ON mua.usuario_id = d.usuario_id
    ),
    contexto AS (
      SELECT
        b.*,
        CASE
          WHEN b.atribuicao_em IS NULL
            OR b.atribuicao_em >
              b.primeira_conversao_em
            THEN NULL
          ELSE b.atribuicao_em
        END AS atribuicao_em_segura,
        (
          b.atribuicao_em IS NOT NULL
          AND b.atribuicao_em >
            b.primeira_conversao_em
        ) AS atribuicao_posterior_conversao
      FROM base b
    ),
    classificado AS (
      SELECT
        contexto.*,
        CASE
          WHEN contexto.atribuicao_em_segura
            IS NULL
            THEN NULL
          ELSE campanha_oficial.id
        END AS campanha_oficial_id,
        CASE
          WHEN contexto.atribuicao_em_segura
            IS NULL
            THEN NULL
          ELSE campanha_oficial.metodo_resolucao
        END AS metodo_resolucao,
        CASE
          WHEN NOT contexto.tem_atribuicao
            OR contexto.atribuicao_em_segura
              IS NULL
            THEN 'sem_evidencia'
          WHEN campanha_oficial.id IS NOT NULL
            THEN 'oficial'
          WHEN contexto.atribuicao_paga
            AND ${campanhaAusente}
            THEN 'rastreamento_incompleto'
          WHEN contexto.atribuicao_paga
            THEN 'identidade_nao_oficial'
          WHEN contexto.trafego_organico
            THEN 'organico'
          WHEN NOT contexto.atribuicao_rastreada
            THEN 'sem_evidencia'
          ELSE 'sem_evidencia'
        END AS classificacao_atribuicao
      FROM contexto
      ${vinculoCampanha}
    )
    INSERT INTO marketing_negocio_aquisicoes (
      negocio_id,
      usuario_aquisicao_id,
      campanha_oficial_id,
      primeiro_pagamento_id,
      plano_entrada_id,
      classificacao_atribuicao,
      metodo_resolucao,
      origem,
      midia,
      campanha,
      atribuicao_em,
      primeira_conversao_em,
      primeira_conversao_data,
      detalhes
    )
    SELECT
      c.negocio_id,
      c.usuario_aquisicao_id,
      c.campanha_oficial_id,
      c.pagamento_id,
      c.plano_novo_id,
      c.classificacao_atribuicao,
      c.metodo_resolucao,
      LEFT(
        CASE
          WHEN c.classificacao_atribuicao =
            'sem_evidencia'
            THEN 'desconhecida'
          ELSE COALESCE(
            NULLIF(
              BTRIM(c.origem_resolvida),
              ''
            ),
            'desconhecida'
          )
        END,
        80
      ),
      LEFT(
        CASE
          WHEN c.classificacao_atribuicao =
            'sem_evidencia'
            THEN 'desconhecida'
          ELSE COALESCE(
            NULLIF(
              BTRIM(c.midia_resolvida),
              ''
            ),
            'desconhecida'
          )
        END,
        80
      ),
      LEFT(
        CASE
          WHEN c.classificacao_atribuicao =
            'sem_evidencia'
            THEN '(sem campanha)'
          ELSE COALESCE(
            NULLIF(
              BTRIM(c.campanha_resolvida),
              ''
            ),
            '(sem campanha)'
          )
        END,
        140
      ),
      c.atribuicao_em_segura,
      c.primeira_conversao_em,
      c.primeira_conversao_data,
      jsonb_build_object(
        'regra',
        'aquisicao_financeira_v1',
        'evento_conversao_id',
        c.evento_id,
        'historico_anterior',
        'nao_inferido',
        'atribuicao_posterior_conversao',
        c.atribuicao_posterior_conversao
      )
    FROM classificado c
    ON CONFLICT (negocio_id)
    DO NOTHING
    RETURNING *
    `,
    [Number(eventoId)]
  );

  return resultado.rows[0] || null;
}

async function contarPendentes() {
  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em
      FROM financeiro_marcos
      WHERE chave =
        'aquisicao_financeira_v1_inicio'
      LIMIT 1
    ),
    conversoes AS (
      SELECT DISTINCT ae.negocio_id
      FROM assinatura_eventos ae
      INNER JOIN pagamentos pg
        ON pg.id = ae.pagamento_id
      CROSS JOIN marco m
      WHERE ae.tipo = 'CONVERSAO_INICIAL'
        AND ae.ocorrido_em >= m.ocorrido_em
        AND pg.data_pagamento IS NOT NULL
    )
    SELECT COUNT(*)::INT AS total
    FROM conversoes c
    LEFT JOIN marketing_negocio_aquisicoes mna
      ON mna.negocio_id = c.negocio_id
    WHERE mna.id IS NULL
    `
  );

  return Number(
    resultado.rows[0]?.total || 0
  );
}

module.exports = {
  listarConversoesPendentes,
  materializarAquisicaoPorEvento,
  contarPendentes,
};
