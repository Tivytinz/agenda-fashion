const db = require(
  "../db/db"
);
const {
  campanhaAusenteSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
} = require(
  "./marketingAttributionSql"
);

const PERIODOS_PERMITIDOS =
  new Set([
    "all",
    "today",
    "7",
    "30",
    "month",
  ]);

const REPORT_TIME_ZONE =
  "America/Sao_Paulo";

const MATURIDADE_PADRAO = Object.freeze({
  ativacao: 14,
  monetizacao: 21,
});

function diasMaturidadeSeguro(
  valor,
  fallback
) {
  const convertido = Number.parseInt(
    valor,
    10
  );

  return Number.isInteger(convertido) &&
    convertido > 0
    ? convertido
    : fallback;
}

function periodoSeguro(valor) {
  const periodo = String(
    valor || "30"
  ).trim();

  return PERIODOS_PERMITIDOS.has(
    periodo
  )
    ? periodo
    : "30";
}

function inicioPeriodoTimestampSql(
  periodo
) {
  const bases = {
    today:
      `date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')`,
    "7":
      `(date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}') - INTERVAL '6 days')`,
    "30":
      `(date_trunc('day', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}') - INTERVAL '29 days')`,
    month:
      `date_trunc('month', NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')`,
  };

  const base =
    bases[periodoSeguro(periodo)];

  return base
    ? `(${base} AT TIME ZONE '${REPORT_TIME_ZONE}')`
    : null;
}

function inicioPeriodoDataSql(
  periodo
) {
  const hoje =
    `(NOW() AT TIME ZONE '${REPORT_TIME_ZONE}')::date`;

  const inicios = {
    today: hoje,
    "7": `(${hoje} - 6)`,
    "30": `(${hoje} - 29)`,
    month:
      `date_trunc('month', ${hoje})::date`,
  };

  return inicios[
    periodoSeguro(periodo)
  ] || null;
}

function filtroTimestamp(
  periodo,
  expressao
) {
  const inicio =
    inicioPeriodoTimestampSql(
      periodo
    );

  return inicio
    ? `AND ${expressao} >= ${inicio}`
    : "";
}

function filtroData(
  periodo,
  expressao
) {
  const inicio =
    inicioPeriodoDataSql(
      periodo
    );

  return inicio
    ? `AND ${expressao} >= ${inicio}`
    : "";
}

async function listarPorCampanha(
  periodo = "30",
  maturidade = {}
) {
  const diasMaturacaoAtivacao =
    diasMaturidadeSeguro(
      maturidade.diasMaturacaoAtivacao,
      MATURIDADE_PADRAO.ativacao
    );
  const diasMaturacaoMonetizacao =
    diasMaturidadeSeguro(
      maturidade.diasMaturacaoMonetizacao,
      MATURIDADE_PADRAO.monetizacao
    );
  const filtroCoorte =
    filtroTimestamp(
      periodo,
      "mua.atribuicao_em"
    );

  const filtroGasto =
    filtroData(
      periodo,
      "g.data_gasto"
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

  const resultado =
    await db.query(
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

      coorte AS (
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
          END
            AS classificacao_atribuicao
        FROM atribuicoes_resolvidas a
        ${vinculoCampanha}
      ),

      funil AS (
        SELECT
          c.usuario_id,
          c.atribuicao_em,
          c.origem,
          c.midia,
          c.campanha,
          c.campanha_oficial_id,
          c.classificacao_atribuicao,

          dono.negocio_id IS NOT NULL
            AS negocio_criado,

          n.primeiro_servico_criado_em IS NOT NULL
            AS servico_criado,

          ac.configurado_em IS NOT NULL
            AS agenda_configurada,

          n.primeira_publicacao_em IS NOT NULL
            AS negocio_publicado,

          n.primeira_publicacao_em,

          divulgacao.primeira_divulgacao_em IS NOT NULL
            AS perfil_divulgado,

          visita.primeira_visita_em IS NOT NULL
            AS visita_pos_divulgacao,

          agendamento_iniciado.primeiro_inicio_em IS NOT NULL
            AS agendamento_iniciado_pos_divulgacao,

          agendamento_via_divulgacao
            .primeiro_agendamento_via_divulgacao_em
            IS NOT NULL
            AS primeiro_agendamento_via_divulgacao,

          primeiro_agendamento.primeiro_agendamento_em
            IS NOT NULL
            AS primeiro_agendamento,

          primeiro_agendamento.primeiro_agendamento_em,

          EXISTS (
            SELECT 1
            FROM checkout_tentativas ct
            WHERE ct.negocio_id = dono.negocio_id
          ) AS checkout_iniciado,

          COALESCE(
            primeiro_pagamento_aquisicao.pagamento_valido,
            FALSE
          ) AS assinatura_ativada,

          COALESCE(
            primeiro_pagamento_aquisicao.valor_centavos,
            0
          )::BIGINT
            AS receita_primeiro_pagamento_centavos,

          primeiro_pagamento_aquisicao.primeiro_pagamento_em

        FROM coorte c

        LEFT JOIN LATERAL (
          SELECT un.negocio_id
          FROM usuarios_negocios un
          WHERE un.usuario_id = c.usuario_id
            AND un.papel = 'dono'
          ORDER BY un.created_at ASC, un.id ASC
          LIMIT 1
        ) dono ON TRUE

        LEFT JOIN negocios n
          ON n.id = dono.negocio_id

        LEFT JOIN agenda_configuracoes ac
          ON ac.profissional_id = c.usuario_id

        LEFT JOIN LATERAL (
          SELECT
            ep.created_at
              AS primeira_divulgacao_em,
            ep.sessao_id
              AS sessao_divulgacao
          FROM eventos_produto ep
          WHERE ep.negocio_id = dono.negocio_id
            AND ep.usuario_id = c.usuario_id
            AND ep.nome IN (
              'link_negocio_copiado',
              'link_negocio_compartilhado'
            )
            AND ep.pagina IN (
              'dashboard_dono',
              'configuracao_agenda'
            )
            AND ac.configurado_em IS NOT NULL
            AND ep.created_at >= ac.configurado_em
          ORDER BY ep.created_at ASC, ep.id ASC
          LIMIT 1
        ) divulgacao ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            ep.created_at
              AS primeira_visita_em
          FROM eventos_produto ep
          WHERE ep.negocio_id = dono.negocio_id
            AND ep.nome = 'perfil_visualizado'
            AND ep.pagina = 'perfil_negocio'
            AND divulgacao.primeira_divulgacao_em
              IS NOT NULL
            AND ep.created_at >=
              divulgacao.primeira_divulgacao_em
            AND ep.sessao_id <>
              divulgacao.sessao_divulgacao
            AND (
              ep.usuario_id IS NULL OR
              ep.usuario_id <> c.usuario_id
            )
          ORDER BY ep.created_at ASC, ep.id ASC
          LIMIT 1
        ) visita ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            ep.created_at
              AS primeiro_inicio_em,
            ep.sessao_id
              AS sessao_inicio
          FROM eventos_produto ep
          WHERE ep.negocio_id = dono.negocio_id
            AND ep.nome = 'agendamento_iniciado'
            AND ep.pagina = 'perfil_negocio'
            AND divulgacao.primeira_divulgacao_em
              IS NOT NULL
            AND ep.created_at >=
              divulgacao.primeira_divulgacao_em
            AND ep.sessao_id <>
              divulgacao.sessao_divulgacao
            AND EXISTS (
              SELECT 1
              FROM eventos_produto ep_visita
              WHERE ep_visita.negocio_id =
                  dono.negocio_id
                AND ep_visita.nome =
                  'perfil_visualizado'
                AND ep_visita.pagina =
                  'perfil_negocio'
                AND ep_visita.sessao_id =
                  ep.sessao_id
                AND ep_visita.created_at >=
                  divulgacao.primeira_divulgacao_em
                AND ep_visita.created_at <=
                  ep.created_at
                AND (
                  ep_visita.usuario_id IS NULL OR
                  ep_visita.usuario_id <> c.usuario_id
                )
            )
          ORDER BY ep.created_at ASC, ep.id ASC
          LIMIT 1
        ) agendamento_iniciado ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            ep.created_at
              AS primeiro_agendamento_via_divulgacao_em
          FROM eventos_produto ep
          INNER JOIN agendamentos ag
            ON ag.id = CASE
              WHEN COALESCE(
                ep.propriedades ->> 'agendamento_id',
                ''
              ) ~ '^[1-9][0-9]*$'
                THEN (
                  ep.propriedades ->> 'agendamento_id'
                )::BIGINT
              ELSE NULL
            END
            AND ag.negocio_id = dono.negocio_id
          WHERE ep.negocio_id = dono.negocio_id
            AND ep.nome = 'agendamento_concluido'
            AND ep.pagina = 'finalizar_agendamento'
            AND agendamento_iniciado.primeiro_inicio_em
              IS NOT NULL
            AND ep.sessao_id =
              agendamento_iniciado.sessao_inicio
            AND ep.created_at >=
              agendamento_iniciado.primeiro_inicio_em
            AND ag.created_at >=
              agendamento_iniciado.primeiro_inicio_em
          ORDER BY ep.created_at ASC, ep.id ASC
          LIMIT 1
        ) agendamento_via_divulgacao ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            MIN(ag.created_at)
              AS primeiro_agendamento_em
          FROM agendamentos ag
          WHERE ag.negocio_id = dono.negocio_id
        ) primeiro_agendamento ON TRUE

        LEFT JOIN LATERAL (
          SELECT
            CASE
              WHEN UPPER(pg.status) IN (
                'CONFIRMED',
                'RECEIVED'
              )
                THEN ROUND(pg.valor * 100)::BIGINT
              ELSE 0::BIGINT
            END AS valor_centavos,
            UPPER(pg.status) IN (
              'CONFIRMED',
              'RECEIVED'
            ) AS pagamento_valido,
            pg.data_pagamento
              AS primeiro_pagamento_em
          FROM assinaturas a
          INNER JOIN planos p
            ON p.id = a.plano_id
          INNER JOIN pagamentos pg
            ON pg.assinatura_id = a.id
          WHERE a.negocio_id = dono.negocio_id
            AND p.valor > 0
            AND pg.data_pagamento IS NOT NULL
          ORDER BY
            pg.data_pagamento ASC,
            pg.id ASC
          LIMIT 1
        ) primeiro_pagamento_aquisicao ON TRUE
      ),

      gastos_por_campanha AS (
        SELECT
          mc.id AS campanha_oficial_id,
          mc.utm_source AS origem,
          mc.utm_medium AS midia,
          mc.utm_campaign AS campanha,
          COALESCE(
            SUM(g.valor_centavos),
            0
          )::BIGINT AS investimento_centavos
        FROM marketing_campanhas mc
        INNER JOIN marketing_campanha_gastos g
          ON g.campanha_id = mc.id
        WHERE g.moeda = 'BRL'
          AND mc.objetivo = 'profissional'
          ${filtroGasto}
        GROUP BY
          mc.id,
          mc.utm_source,
          mc.utm_medium,
          mc.utm_campaign
      ),

      agrupado AS (
        SELECT
          f.origem,
          f.midia,
          f.campanha,
          f.campanha_oficial_id,
          f.classificacao_atribuicao,
          COUNT(*)::INT AS cadastros,
          COUNT(*) FILTER (
            WHERE f.negocio_criado
          )::INT AS negocios_criados,
          COUNT(*) FILTER (
            WHERE f.servico_criado
          )::INT AS servicos_criados,
          COUNT(*) FILTER (
            WHERE f.agenda_configurada
          )::INT AS agendas_configuradas,
          COUNT(*) FILTER (
            WHERE f.negocio_publicado
          )::INT AS negocios_publicados,
          COUNT(*) FILTER (
            WHERE f.perfil_divulgado
          )::INT AS perfis_divulgados,
          COUNT(*) FILTER (
            WHERE f.visita_pos_divulgacao
          )::INT AS visitas_pos_divulgacao,
          COUNT(*) FILTER (
            WHERE f.agendamento_iniciado_pos_divulgacao
          )::INT AS agendamentos_iniciados_pos_divulgacao,
          COUNT(*) FILTER (
            WHERE f.primeiro_agendamento_via_divulgacao
          )::INT AS primeiros_agendamentos_via_divulgacao,
          COUNT(*) FILTER (
            WHERE f.primeiro_agendamento
          )::INT AS primeiros_agendamentos,
          COUNT(*) FILTER (
            WHERE f.checkout_iniciado
          )::INT AS checkouts_iniciados,
          COUNT(*) FILTER (
            WHERE f.assinatura_ativada
          )::INT AS assinaturas_ativadas,
          COUNT(*) FILTER (
            WHERE f.atribuicao_em <=
              NOW() - ($1::INT * INTERVAL '1 day')
          )::INT AS cadastros_maduros_ativacao,
          COUNT(*) FILTER (
            WHERE f.atribuicao_em <=
              NOW() - ($2::INT * INTERVAL '1 day')
          )::INT AS cadastros_maduros_monetizacao,
          COUNT(*) FILTER (
            WHERE f.negocio_publicado
              AND f.atribuicao_em <=
                NOW() - ($1::INT * INTERVAL '1 day')
              AND f.primeira_publicacao_em <=
                f.atribuicao_em +
                  ($1::INT * INTERVAL '1 day')
          )::INT AS negocios_publicados_maduros_ativacao,
          COUNT(*) FILTER (
            WHERE f.primeiro_agendamento
              AND f.atribuicao_em <=
                NOW() - ($1::INT * INTERVAL '1 day')
              AND f.primeiro_agendamento_em <=
                f.atribuicao_em +
                  ($1::INT * INTERVAL '1 day')
          )::INT AS primeiros_agendamentos_maduros_ativacao,
          COUNT(*) FILTER (
            WHERE f.assinatura_ativada
              AND f.atribuicao_em <=
                NOW() - ($2::INT * INTERVAL '1 day')
              AND f.primeiro_pagamento_em <=
                (
                  f.atribuicao_em AT TIME ZONE
                    '${REPORT_TIME_ZONE}' +
                  ($2::INT * INTERVAL '1 day')
                )::date
          )::INT AS assinaturas_ativadas_maduras_monetizacao,
          COALESCE(
            SUM(
              f.receita_primeiro_pagamento_centavos
            ),
            0
          )::BIGINT
            AS receita_primeiro_pagamento_centavos
        FROM funil f
        GROUP BY
          f.origem,
          f.midia,
          f.campanha,
          f.campanha_oficial_id,
          f.classificacao_atribuicao
      )

      SELECT
        COALESCE(
          a.origem,
          g.origem
        ) AS origem,
        COALESCE(
          a.midia,
          g.midia
        ) AS midia,
        COALESCE(
          a.campanha,
          g.campanha
        ) AS campanha,
        COALESCE(
          a.campanha_oficial_id,
          g.campanha_oficial_id
        ) AS campanha_oficial_id,
        COALESCE(
          a.classificacao_atribuicao,
          'oficial'
        ) AS classificacao_atribuicao,
        COALESCE(
          a.cadastros,
          0
        )::INT AS cadastros,
        COALESCE(
          a.negocios_criados,
          0
        )::INT AS negocios_criados,
        COALESCE(
          a.servicos_criados,
          0
        )::INT AS servicos_criados,
        COALESCE(
          a.agendas_configuradas,
          0
        )::INT AS agendas_configuradas,
        COALESCE(
          a.negocios_publicados,
          0
        )::INT AS negocios_publicados,
        COALESCE(
          a.perfis_divulgados,
          0
        )::INT AS perfis_divulgados,
        COALESCE(
          a.visitas_pos_divulgacao,
          0
        )::INT AS visitas_pos_divulgacao,
        COALESCE(
          a.agendamentos_iniciados_pos_divulgacao,
          0
        )::INT AS agendamentos_iniciados_pos_divulgacao,
        COALESCE(
          a.primeiros_agendamentos_via_divulgacao,
          0
        )::INT AS primeiros_agendamentos_via_divulgacao,
        COALESCE(
          a.primeiros_agendamentos,
          0
        )::INT AS primeiros_agendamentos,
        COALESCE(
          a.checkouts_iniciados,
          0
        )::INT AS checkouts_iniciados,
        COALESCE(
          a.assinaturas_ativadas,
          0
        )::INT AS assinaturas_ativadas,
        COALESCE(
          a.cadastros_maduros_ativacao,
          0
        )::INT AS cadastros_maduros_ativacao,
        COALESCE(
          a.cadastros_maduros_monetizacao,
          0
        )::INT AS cadastros_maduros_monetizacao,
        COALESCE(
          a.negocios_publicados_maduros_ativacao,
          0
        )::INT AS negocios_publicados_maduros_ativacao,
        COALESCE(
          a.primeiros_agendamentos_maduros_ativacao,
          0
        )::INT AS primeiros_agendamentos_maduros_ativacao,
        COALESCE(
          a.assinaturas_ativadas_maduras_monetizacao,
          0
        )::INT AS assinaturas_ativadas_maduras_monetizacao,
        COALESCE(
          a.receita_primeiro_pagamento_centavos,
          0
        )::BIGINT
          AS receita_primeiro_pagamento_centavos,
        COALESCE(
          g.investimento_centavos,
          0
        )::BIGINT AS investimento_centavos
      FROM agrupado a
      FULL OUTER JOIN gastos_por_campanha g
        ON g.campanha_oficial_id =
          a.campanha_oficial_id
      ORDER BY
        assinaturas_ativadas DESC,
        receita_primeiro_pagamento_centavos DESC,
        checkouts_iniciados DESC,
        cadastros DESC,
        investimento_centavos DESC,
        origem ASC,
        campanha ASC
      `,
      [
        diasMaturacaoAtivacao,
        diasMaturacaoMonetizacao,
      ]
    );

  return resultado.rows;
}

module.exports = {
  listarPorCampanha,
  periodoSeguro,
  filtroData,
  filtroTimestamp,
};
