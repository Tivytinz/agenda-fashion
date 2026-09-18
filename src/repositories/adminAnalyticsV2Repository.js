const db = require("../db/db");

const PERIODOS = new Set([
  "today",
  "7",
  "30",
  "month",
  "all",
]);
const TIME_ZONE = "America/Sao_Paulo";

function periodoSeguro(valor) {
  const periodo = String(valor || "30").trim();
  return PERIODOS.has(periodo) ? periodo : "30";
}

function inicioTimestampSql(periodo) {
  const localNow = `(NOW() AT TIME ZONE '${TIME_ZONE}')`;
  const bases = {
    today: `date_trunc('day', ${localNow})`,
    "7": `(date_trunc('day', ${localNow}) - INTERVAL '6 days')`,
    "30": `(date_trunc('day', ${localNow}) - INTERVAL '29 days')`,
    month: `date_trunc('month', ${localNow})`,
  };
  const base = bases[periodoSeguro(periodo)];
  return base ? `(${base} AT TIME ZONE '${TIME_ZONE}')` : null;
}

function inicioDataSql(periodo) {
  const hoje = `(NOW() AT TIME ZONE '${TIME_ZONE}')::date`;
  const bases = {
    today: hoje,
    "7": `(${hoje} - 6)`,
    "30": `(${hoje} - 29)`,
    month: `date_trunc('month', ${hoje})::date`,
  };
  return bases[periodoSeguro(periodo)] || null;
}

function filtroTimestamp(periodo, expressao) {
  const inicio = inicioTimestampSql(periodo);
  return inicio ? `AND ${expressao} >= ${inicio}` : "";
}

function filtroData(periodo, expressao) {
  const inicio = inicioDataSql(periodo);
  return inicio ? `AND ${expressao} >= ${inicio}` : "";
}

async function buscarVisaoGeral(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroSessao = filtroTimestamp(seguro, "s.iniciada_em");
  const filtroCadastro = filtroTimestamp(seguro, "mua.atribuicao_em");
  const filtroNegocio = filtroTimestamp(seguro, "n.created_at");
  const filtroPublicado = filtroTimestamp(seguro, "n.primeira_publicacao_em");
  const filtroAgendamento = filtroTimestamp(seguro, "ag.created_at");
  const filtroPrimeiroAgendamento = filtroTimestamp(seguro, "p.primeiro_agendamento_em");
  const filtroPagamento = filtroData(seguro, "pg.data_pagamento");

  const resultado = await db.query(
    `
    WITH
    sessoes AS (
      SELECT
        COUNT(*)::INT AS sessoes,
        COUNT(DISTINCT CASE
          WHEN s.usuario_id IS NOT NULL THEN 'u:' || s.usuario_id::TEXT
          ELSE 'v:' || s.visitante_id::TEXT
        END)::INT AS usuarios_ativos,
        COALESCE(SUM(s.visualizacoes), 0)::BIGINT AS visualizacoes,
        COALESCE(SUM(s.tempo_engajado_ms), 0)::BIGINT AS tempo_engajado_ms
      FROM analytics_sessoes s
      WHERE 1 = 1
        ${filtroSessao}
    ),
    profissionais AS (
      SELECT COUNT(DISTINCT mua.usuario_id)::INT AS cadastros_profissionais
      FROM marketing_usuario_atribuicoes mua
      WHERE mua.intencao = 'profissional'
        ${filtroCadastro}
    ),
    negocios_criados AS (
      SELECT COUNT(*)::INT AS negocios_criados
      FROM negocios n
      WHERE n.ativo = TRUE
        ${filtroNegocio}
    ),
    publicados AS (
      SELECT COUNT(*)::INT AS negocios_publicados
      FROM negocios n
      WHERE n.primeira_publicacao_em IS NOT NULL
        ${filtroPublicado}
    ),
    agendamentos_resumo AS (
      SELECT COUNT(*)::INT AS agendamentos_validos
      FROM agendamentos ag
      WHERE COALESCE(ag.status, 'agendado') <> 'cancelado'
        ${filtroAgendamento}
    ),
    primeiro_por_negocio AS (
      SELECT
        ag.negocio_id,
        MIN(ag.created_at) AS primeiro_agendamento_em
      FROM agendamentos ag
      WHERE COALESCE(ag.status, 'agendado') <> 'cancelado'
      GROUP BY ag.negocio_id
    ),
    primeiros_agendamentos AS (
      SELECT COUNT(*)::INT AS primeiros_agendamentos
      FROM primeiro_por_negocio p
      WHERE 1 = 1
        ${filtroPrimeiroAgendamento}
    ),
    pagamentos_resumo AS (
      SELECT
        COUNT(*)::INT AS pagamentos_confirmados,
        COUNT(DISTINCT a.negocio_id)::INT AS negocios_com_pagamento,
        COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_confirmada
      FROM pagamentos pg
      INNER JOIN assinaturas a
        ON a.id = pg.assinatura_id
      INNER JOIN planos pl
        ON pl.id = a.plano_id
      WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
        AND pg.data_pagamento IS NOT NULL
        AND pl.valor > 0
        ${filtroPagamento}
    )
    SELECT
      s.sessoes,
      s.usuarios_ativos,
      s.visualizacoes,
      s.tempo_engajado_ms,
      p.cadastros_profissionais,
      n.negocios_criados,
      pub.negocios_publicados,
      ag.agendamentos_validos,
      pa.primeiros_agendamentos,
      pg.pagamentos_confirmados,
      pg.negocios_com_pagamento,
      pg.receita_confirmada
    FROM sessoes s
    CROSS JOIN profissionais p
    CROSS JOIN negocios_criados n
    CROSS JOIN publicados pub
    CROSS JOIN agendamentos_resumo ag
    CROSS JOIN primeiros_agendamentos pa
    CROSS JOIN pagamentos_resumo pg
    `
  );

  return {
    periodo: seguro,
    ...(resultado.rows[0] || {}),
  };
}

async function listarAquisicao(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtro = filtroTimestamp(seguro, "s.iniciada_em");

  const resultado = await db.query(
    `
    SELECT
      o.canal,
      COALESCE(o.source, 'não identificado') AS source,
      COALESCE(o.medium, 'não identificado') AS medium,
      o.campanha_oficial_id,
      mc.nome AS campanha_nome,
      mc.utm_campaign,
      o.classificacao,
      COUNT(*)::INT AS sessoes,
      COUNT(DISTINCT CASE
        WHEN s.usuario_id IS NOT NULL THEN 'u:' || s.usuario_id::TEXT
        ELSE 'v:' || s.visitante_id::TEXT
      END)::INT AS usuarios,
      COALESCE(SUM(s.visualizacoes), 0)::BIGINT AS visualizacoes,
      COALESCE(SUM(s.tempo_engajado_ms), 0)::BIGINT AS tempo_engajado_ms
    FROM analytics_sessoes s
    INNER JOIN analytics_sessao_origens o
      ON o.sessao_id = s.id
    LEFT JOIN marketing_campanhas mc
      ON mc.id = o.campanha_oficial_id
    WHERE 1 = 1
      ${filtro}
    GROUP BY
      o.canal,
      o.source,
      o.medium,
      o.campanha_oficial_id,
      mc.nome,
      mc.utm_campaign,
      o.classificacao
    ORDER BY
      COUNT(*) DESC,
      o.canal ASC,
      o.source ASC
    LIMIT 100
    `
  );

  return {
    periodo: seguro,
    origens: resultado.rows,
  };
}

async function buscarJornada(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroVisualizacao = filtroTimestamp(seguro, "v.entrou_em");
  const filtroEvento = filtroTimestamp(seguro, "e.occurred_at");
  const filtroSessao = filtroTimestamp(seguro, "s.iniciada_em");
  const filtroPublicacao = filtroTimestamp(seguro, "n.primeira_publicacao_em");

  const [telas, transicoes, eventos, dispositivos, posPublicacao] =
    await Promise.all([
      db.query(
        `
        SELECT
          v.page_key,
          MIN(v.route_template) AS route_template,
          COUNT(*)::INT AS visualizacoes,
          COUNT(DISTINCT v.sessao_id)::INT AS sessoes,
          COALESCE(ROUND(AVG(v.tempo_engajado_ms) / 1000.0, 2), 0)::NUMERIC AS tempo_medio_segundos
        FROM analytics_visualizacoes_tela v
        WHERE 1 = 1
          ${filtroVisualizacao}
        GROUP BY v.page_key
        ORDER BY COUNT(*) DESC, v.page_key ASC
        LIMIT 50
        `
      ),
      db.query(
        `
        WITH ordenadas AS (
          SELECT
            v.sessao_id,
            v.page_key AS origem,
            LEAD(v.page_key) OVER (
              PARTITION BY v.sessao_id
              ORDER BY v.sequencia ASC
            ) AS destino
          FROM analytics_visualizacoes_tela v
          WHERE 1 = 1
            ${filtroVisualizacao}
        )
        SELECT
          origem,
          destino,
          COUNT(*)::INT AS transicoes
        FROM ordenadas
        WHERE destino IS NOT NULL
        GROUP BY origem, destino
        ORDER BY COUNT(*) DESC, origem ASC, destino ASC
        LIMIT 50
        `
      ),
      db.query(
        `
        SELECT
          e.nome,
          COUNT(*)::INT AS eventos,
          COUNT(DISTINCT e.sessao_id)::INT AS sessoes
        FROM analytics_eventos e
        WHERE e.origem = 'frontend'
          ${filtroEvento}
        GROUP BY e.nome
        ORDER BY COUNT(*) DESC, e.nome ASC
        `
      ),
      db.query(
        `
        SELECT
          COALESCE(s.device_type, 'unknown') AS device_type,
          COALESCE(s.browser_family, 'Unknown') AS browser_family,
          COUNT(*)::INT AS sessoes
        FROM analytics_sessoes s
        WHERE 1 = 1
          ${filtroSessao}
        GROUP BY s.device_type, s.browser_family
        ORDER BY COUNT(*) DESC
        LIMIT 50
        `
      ),
      db.query(
        `
        WITH publicados AS (
          SELECT
            n.id AS negocio_id,
            n.primeira_publicacao_em
          FROM negocios n
          WHERE n.ativo = TRUE
            AND n.primeira_publicacao_em IS NOT NULL
            ${filtroPublicacao}
        ),
        compartilhamentos AS (
          SELECT
            p.negocio_id,
            MIN(e.occurred_at) AS compartilhado_em
          FROM publicados p
          LEFT JOIN analytics_eventos e
            ON e.target_business_id = p.negocio_id
           AND e.origem = 'frontend'
           AND e.nome = 'profile_shared'
           AND e.occurred_at >= p.primeira_publicacao_em
          GROUP BY p.negocio_id
        ),
        visitas AS (
          SELECT DISTINCT ON (c.negocio_id)
            c.negocio_id,
            e.sessao_id,
            e.occurred_at AS visitado_em
          FROM compartilhamentos c
          INNER JOIN analytics_eventos e
            ON e.target_business_id = c.negocio_id
           AND e.origem = 'frontend'
           AND e.nome = 'profile_viewed'
           AND c.compartilhado_em IS NOT NULL
           AND e.occurred_at >= c.compartilhado_em
          INNER JOIN analytics_sessao_origens aso
            ON aso.sessao_id = e.sessao_id
           AND aso.metodo_resolucao = 'af_link'
          WHERE NOT EXISTS (
            SELECT 1
            FROM usuarios_negocios un
            WHERE un.negocio_id = c.negocio_id
              AND un.usuario_id = e.actor_user_id
              AND un.ativo = TRUE
              AND un.papel IN ('dono', 'profissional')
          )
          ORDER BY
            c.negocio_id,
            e.occurred_at ASC,
            e.id ASC
        ),
        inicios AS (
          SELECT DISTINCT ON (v.negocio_id)
            v.negocio_id,
            v.sessao_id,
            e.occurred_at AS iniciado_em
          FROM visitas v
          INNER JOIN analytics_eventos e
            ON e.sessao_id = v.sessao_id
           AND e.target_business_id = v.negocio_id
           AND e.origem = 'frontend'
           AND e.nome = 'booking_started'
           AND e.occurred_at >= v.visitado_em
          ORDER BY
            v.negocio_id,
            e.occurred_at ASC,
            e.id ASC
        ),
        conclusoes AS (
          SELECT DISTINCT ON (i.negocio_id)
            i.negocio_id,
            a.created_at AS primeiro_agendamento_em
          FROM inicios i
          INNER JOIN analytics_eventos e
            ON e.sessao_id = i.sessao_id
           AND e.target_business_id = i.negocio_id
           AND e.origem = 'frontend'
           AND e.nome = 'booking_completed'
           AND e.occurred_at >= i.iniciado_em
           AND NULLIF(
             BTRIM(e.propriedades ->> 'appointment_id'),
             ''
           ) ~ '^[0-9]+
        SELECT
          COUNT(*)::INT AS negocios_publicados,
          COUNT(*) FILTER (
            WHERE c.compartilhado_em IS NOT NULL
          )::INT AS perfis_compartilhados,
          COUNT(*) FILTER (
            WHERE v.visitado_em IS NOT NULL
          )::INT AS visitas_externas_pos_compartilhamento,
          COUNT(*) FILTER (
            WHERE i.iniciado_em IS NOT NULL
          )::INT AS agendamentos_iniciados_pos_visita,
          COUNT(*) FILTER (
            WHERE co.primeiro_agendamento_em IS NOT NULL
          )::INT AS primeiros_agendamentos_validos
        FROM publicados p
        LEFT JOIN compartilhamentos c
          ON c.negocio_id = p.negocio_id
        LEFT JOIN visitas v
          ON v.negocio_id = p.negocio_id
        LEFT JOIN inicios i
          ON i.negocio_id = p.negocio_id
        LEFT JOIN conclusoes co
          ON co.negocio_id = p.negocio_id
        `
      ),
    ]);

  return {
    periodo: seguro,
    telas: telas.rows,
    transicoes: transicoes.rows,
    eventos: eventos.rows,
    dispositivos: dispositivos.rows,
    posPublicacao: posPublicacao.rows[0] || {
      negocios_publicados: 0,
      perfis_compartilhados: 0,
      visitas_externas_pos_compartilhamento: 0,
      agendamentos_iniciados_pos_visita: 0,
      primeiros_agendamentos_validos: 0,
    },
  };
}

async function buscarReceita(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroCheckout = filtroTimestamp(seguro, "ct.created_at");
  const filtroPagamento = filtroData(seguro, "pg.data_pagamento");
  const filtroAjuste = filtroTimestamp(seguro, "pg.updated_at");
  const filtroPrimeiroPagamento = filtroData(seguro, "fp.data_pagamento");

  const [resumo, planos] = await Promise.all([
    db.query(
      `
      WITH checkouts AS (
        SELECT
          COUNT(*)::INT AS iniciados,
          COUNT(*) FILTER (WHERE ct.status = 'COMPLETED')::INT AS concluidos,
          COUNT(*) FILTER (WHERE ct.status = 'FAILED')::INT AS falhos
        FROM checkout_tentativas ct
        WHERE 1 = 1
          ${filtroCheckout}
      ),
      checkout_coorte AS (
        SELECT
          COUNT(DISTINCT ct.negocio_id)::INT AS negocios_com_checkout,
          COUNT(DISTINCT ct.negocio_id) FILTER (
            WHERE ct.assinatura_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM pagamentos cpg
                INNER JOIN assinaturas ca
                  ON ca.id = cpg.assinatura_id
                INNER JOIN planos cpl
                  ON cpl.id = ca.plano_id
                WHERE cpg.assinatura_id = ct.assinatura_id
                  AND UPPER(cpg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
                  AND cpg.data_pagamento IS NOT NULL
                  AND cpl.valor > 0
              )
          )::INT AS negocios_checkout_convertidos
        FROM checkout_tentativas ct
        WHERE 1 = 1
          ${filtroCheckout}
      ),
      pagamentos_resumo AS (
        SELECT
          COUNT(*)::INT AS pagamentos_confirmados,
          COUNT(DISTINCT a.negocio_id)::INT AS negocios_pagantes,
          COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_total
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
          AND pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroPagamento}
      ),
      ajustes_financeiros AS (
        SELECT
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) = 'REFUNDED'
          )::INT AS pagamentos_reembolsados,
          COALESCE(
            SUM(pg.valor) FILTER (
              WHERE UPPER(pg.status) = 'REFUNDED'
            ),
            0
          )::NUMERIC(14,2) AS valor_reembolsado,
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) IN (
              'PARTIALLY_REFUNDED',
              'REFUND_IN_PROGRESS',
              'CHARGEBACK_REQUESTED',
              'CHARGEBACK_DISPUTE',
              'AWAITING_CHARGEBACK_REVERSAL',
              'RECEIVED_IN_CASH_UNDONE'
            )
          )::INT AS pagamentos_com_ajuste
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroAjuste}
      ),
      primeiros AS (
        SELECT DISTINCT ON (pg.assinatura_id)
          pg.assinatura_id,
          pg.id AS pagamento_id
        FROM pagamentos pg
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
          AND pg.data_pagamento IS NOT NULL
        ORDER BY
          pg.assinatura_id,
          pg.data_pagamento ASC,
          pg.id ASC
      ),
      primeiros_pagamentos AS (
        SELECT
          COUNT(*)::INT AS novas_assinaturas_pagas,
          COALESCE(SUM(fp.valor), 0)::NUMERIC(14,2) AS receita_primeiro_pagamento
        FROM primeiros p
        INNER JOIN pagamentos fp
          ON fp.id = p.pagamento_id
        INNER JOIN assinaturas a
          ON a.id = fp.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pl.valor > 0
          ${filtroPrimeiroPagamento}
      ),
      ativas AS (
        SELECT COUNT(*)::INT AS assinaturas_pagas_ativas
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = TRUE
          AND pl.valor > 0
      )
      SELECT
        c.iniciados AS checkouts_iniciados,
        c.concluidos AS checkouts_concluidos,
        c.falhos AS checkouts_falhos,
        cc.negocios_com_checkout,
        cc.negocios_checkout_convertidos,
        p.pagamentos_confirmados,
        p.negocios_pagantes,
        p.receita_total,
        aj.pagamentos_reembolsados,
        aj.valor_reembolsado,
        aj.pagamentos_com_ajuste,
        fp.novas_assinaturas_pagas,
        fp.receita_primeiro_pagamento,
        a.assinaturas_pagas_ativas
      FROM checkouts c
      CROSS JOIN checkout_coorte cc
      CROSS JOIN pagamentos_resumo p
      CROSS JOIN ajustes_financeiros aj
      CROSS JOIN primeiros_pagamentos fp
      CROSS JOIN ativas a
      `
    ),
    db.query(
      `
      SELECT
        pl.id,
        pl.nome,
        pl.slug,
        COUNT(*)::INT AS assinaturas_ativas,
        COALESCE(SUM(a.valor), 0)::NUMERIC(14,2) AS valor_mensal_contratado
      FROM assinaturas a
      INNER JOIN planos pl
        ON pl.id = a.plano_id
      WHERE a.ativo = TRUE
        AND pl.valor > 0
      GROUP BY pl.id, pl.nome, pl.slug
      ORDER BY COUNT(*) DESC, pl.nome ASC
      `
    ),
  ]);

  return {
    periodo: seguro,
    resumo: resumo.rows[0] || {},
    planos: planos.rows,
  };
}

module.exports = {
  periodoSeguro,
  buscarVisaoGeral,
  listarAquisicao,
  buscarJornada,
  buscarReceita,
};

          INNER JOIN agendamentos a
            ON a.id = (
              e.propriedades ->> 'appointment_id'
            )::BIGINT
           AND a.negocio_id = i.negocio_id
           AND COALESCE(a.status, 'agendado') <> 'cancelado'
          ORDER BY
            i.negocio_id,
            e.occurred_at ASC,
            e.id ASC
        )
        SELECT
          COUNT(*)::INT AS negocios_publicados,
          COUNT(*) FILTER (
            WHERE c.compartilhado_em IS NOT NULL
          )::INT AS perfis_compartilhados,
          COUNT(*) FILTER (
            WHERE v.visitado_em IS NOT NULL
          )::INT AS visitas_externas_pos_compartilhamento,
          COUNT(*) FILTER (
            WHERE i.iniciado_em IS NOT NULL
          )::INT AS agendamentos_iniciados_pos_visita,
          COUNT(*) FILTER (
            WHERE co.primeiro_agendamento_em IS NOT NULL
          )::INT AS primeiros_agendamentos_validos
        FROM publicados p
        LEFT JOIN compartilhamentos c
          ON c.negocio_id = p.negocio_id
        LEFT JOIN visitas v
          ON v.negocio_id = p.negocio_id
        LEFT JOIN inicios i
          ON i.negocio_id = p.negocio_id
        LEFT JOIN conclusoes co
          ON co.negocio_id = p.negocio_id
        `
      ),
    ]);

  return {
    periodo: seguro,
    telas: telas.rows,
    transicoes: transicoes.rows,
    eventos: eventos.rows,
    dispositivos: dispositivos.rows,
    posPublicacao: posPublicacao.rows[0] || {
      negocios_publicados: 0,
      perfis_compartilhados: 0,
      visitas_externas_pos_compartilhamento: 0,
      agendamentos_iniciados_pos_visita: 0,
      primeiros_agendamentos_validos: 0,
    },
  };
}

async function buscarReceita(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroCheckout = filtroTimestamp(seguro, "ct.created_at");
  const filtroPagamento = filtroData(seguro, "pg.data_pagamento");
  const filtroAjuste = filtroTimestamp(seguro, "pg.updated_at");
  const filtroPrimeiroPagamento = filtroData(seguro, "fp.data_pagamento");

  const [resumo, planos] = await Promise.all([
    db.query(
      `
      WITH checkouts AS (
        SELECT
          COUNT(*)::INT AS iniciados,
          COUNT(*) FILTER (WHERE ct.status = 'COMPLETED')::INT AS concluidos,
          COUNT(*) FILTER (WHERE ct.status = 'FAILED')::INT AS falhos
        FROM checkout_tentativas ct
        WHERE 1 = 1
          ${filtroCheckout}
      ),
      checkout_coorte AS (
        SELECT
          COUNT(DISTINCT ct.negocio_id)::INT AS negocios_com_checkout,
          COUNT(DISTINCT ct.negocio_id) FILTER (
            WHERE ct.assinatura_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM pagamentos cpg
                INNER JOIN assinaturas ca
                  ON ca.id = cpg.assinatura_id
                INNER JOIN planos cpl
                  ON cpl.id = ca.plano_id
                WHERE cpg.assinatura_id = ct.assinatura_id
                  AND UPPER(cpg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
                  AND cpg.data_pagamento IS NOT NULL
                  AND cpl.valor > 0
              )
          )::INT AS negocios_checkout_convertidos
        FROM checkout_tentativas ct
        WHERE 1 = 1
          ${filtroCheckout}
      ),
      pagamentos_resumo AS (
        SELECT
          COUNT(*)::INT AS pagamentos_confirmados,
          COUNT(DISTINCT a.negocio_id)::INT AS negocios_pagantes,
          COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_total
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
          AND pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroPagamento}
      ),
      ajustes_financeiros AS (
        SELECT
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) = 'REFUNDED'
          )::INT AS pagamentos_reembolsados,
          COALESCE(
            SUM(pg.valor) FILTER (
              WHERE UPPER(pg.status) = 'REFUNDED'
            ),
            0
          )::NUMERIC(14,2) AS valor_reembolsado,
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) IN (
              'PARTIALLY_REFUNDED',
              'REFUND_IN_PROGRESS',
              'CHARGEBACK_REQUESTED',
              'CHARGEBACK_DISPUTE',
              'AWAITING_CHARGEBACK_REVERSAL',
              'RECEIVED_IN_CASH_UNDONE'
            )
          )::INT AS pagamentos_com_ajuste
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroAjuste}
      ),
      primeiros AS (
        SELECT DISTINCT ON (pg.assinatura_id)
          pg.assinatura_id,
          pg.id AS pagamento_id
        FROM pagamentos pg
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH')
          AND pg.data_pagamento IS NOT NULL
        ORDER BY
          pg.assinatura_id,
          pg.data_pagamento ASC,
          pg.id ASC
      ),
      primeiros_pagamentos AS (
        SELECT
          COUNT(*)::INT AS novas_assinaturas_pagas,
          COALESCE(SUM(fp.valor), 0)::NUMERIC(14,2) AS receita_primeiro_pagamento
        FROM primeiros p
        INNER JOIN pagamentos fp
          ON fp.id = p.pagamento_id
        INNER JOIN assinaturas a
          ON a.id = fp.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pl.valor > 0
          ${filtroPrimeiroPagamento}
      ),
      ativas AS (
        SELECT COUNT(*)::INT AS assinaturas_pagas_ativas
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = TRUE
          AND pl.valor > 0
      )
      SELECT
        c.iniciados AS checkouts_iniciados,
        c.concluidos AS checkouts_concluidos,
        c.falhos AS checkouts_falhos,
        cc.negocios_com_checkout,
        cc.negocios_checkout_convertidos,
        p.pagamentos_confirmados,
        p.negocios_pagantes,
        p.receita_total,
        aj.pagamentos_reembolsados,
        aj.valor_reembolsado,
        aj.pagamentos_com_ajuste,
        fp.novas_assinaturas_pagas,
        fp.receita_primeiro_pagamento,
        a.assinaturas_pagas_ativas
      FROM checkouts c
      CROSS JOIN checkout_coorte cc
      CROSS JOIN pagamentos_resumo p
      CROSS JOIN ajustes_financeiros aj
      CROSS JOIN primeiros_pagamentos fp
      CROSS JOIN ativas a
      `
    ),
    db.query(
      `
      SELECT
        pl.id,
        pl.nome,
        pl.slug,
        COUNT(*)::INT AS assinaturas_ativas,
        COALESCE(SUM(a.valor), 0)::NUMERIC(14,2) AS valor_mensal_contratado
      FROM assinaturas a
      INNER JOIN planos pl
        ON pl.id = a.plano_id
      WHERE a.ativo = TRUE
        AND pl.valor > 0
      GROUP BY pl.id, pl.nome, pl.slug
      ORDER BY COUNT(*) DESC, pl.nome ASC
      `
    ),
  ]);

  return {
    periodo: seguro,
    resumo: resumo.rows[0] || {},
    planos: planos.rows,
  };
}

module.exports = {
  periodoSeguro,
  buscarVisaoGeral,
  listarAquisicao,
  buscarJornada,
  buscarReceita,
};
