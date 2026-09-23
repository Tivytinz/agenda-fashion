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
      SELECT
        COUNT(*)::INT AS agendamentos_validos,
        COUNT(DISTINCT ag.client_id)::INT
          AS clientes_com_agendamento
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
      ag.clientes_com_agendamento,
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

  const [telas, transicoes, eventos, dispositivos] = await Promise.all([
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
  ]);

  return {
    periodo: seguro,
    telas: telas.rows,
    transicoes: transicoes.rows,
    eventos: eventos.rows,
    dispositivos: dispositivos.rows,
  };
}

async function buscarReceita(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroCheckout = filtroTimestamp(seguro, "ct.created_at");
  const filtroPagamento = filtroData(seguro, "pg.data_pagamento");
  const filtroPrimeiroPagamento = filtroData(seguro, "fp.data_pagamento");
  const filtroReceitaClassificada = filtroData(
    seguro,
    "pc.data_pagamento"
  );
  const filtroRenovacaoVencimento = filtroData(
    seguro,
    "cr.data_vencimento"
  );
  const filtroEncerramentoCancelado = filtroTimestamp(
    seguro,
    "a.updated_at"
  );

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
                  AND UPPER(cpg.status) IN (
                    'CONFIRMED',
                    'RECEIVED',
                    'RECEIVED_IN_CASH'
                  )
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
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
          )::INT AS pagamentos_confirmados,
          COUNT(DISTINCT a.negocio_id) FILTER (
            WHERE UPPER(pg.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
          )::INT AS negocios_pagantes,
          COALESCE(SUM(pg.valor) FILTER (
            WHERE UPPER(pg.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
          ), 0)::NUMERIC(14,2) AS receita_total,
          COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_bruta,
          COUNT(*) FILTER (
            WHERE UPPER(pg.status) IN (
              'REFUNDED',
              'PARTIALLY_REFUNDED',
              'REFUND_IN_PROGRESS',
              'RECEIVED_IN_CASH_UNDONE',
              'CHARGEBACK_REQUESTED',
              'CHARGEBACK_DISPUTE',
              'AWAITING_CHARGEBACK_REVERSAL'
            )
          )::INT AS pagamentos_em_reversao,
          COALESCE(SUM(pg.valor) FILTER (
            WHERE UPPER(pg.status) IN (
              'REFUNDED',
              'PARTIALLY_REFUNDED',
              'REFUND_IN_PROGRESS',
              'RECEIVED_IN_CASH_UNDONE',
              'CHARGEBACK_REQUESTED',
              'CHARGEBACK_DISPUTE',
              'AWAITING_CHARGEBACK_REVERSAL'
            )
          ), 0)::NUMERIC(14,2) AS valor_exposto_reversoes
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroPagamento}
      ),
      primeiros AS (
        SELECT DISTINCT ON (pg.assinatura_id)
          pg.assinatura_id,
          pg.id AS pagamento_id
        FROM pagamentos pg
        WHERE UPPER(pg.status) IN (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH'
          )
          AND pg.data_pagamento IS NOT NULL
        ORDER BY
          pg.assinatura_id,
          pg.data_pagamento ASC,
          pg.id ASC
      ),
      primeiros_pagamentos AS (
        SELECT
          COUNT(*)::INT AS novas_assinaturas_pagas,
          COALESCE(SUM(fp.valor), 0)::NUMERIC(14,2)
            AS receita_primeiro_pagamento
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
      pagamentos_classificados AS (
        SELECT
          pg.id,
          pg.assinatura_id,
          a.negocio_id,
          pg.valor,
          pg.status,
          pg.data_pagamento,
          ROW_NUMBER() OVER (
            PARTITION BY a.negocio_id
            ORDER BY
              pg.data_pagamento ASC,
              pg.id ASC
          ) AS ordem_negocio,
          ROW_NUMBER() OVER (
            PARTITION BY pg.assinatura_id
            ORDER BY
              pg.data_pagamento ASC,
              pg.id ASC
          ) AS ordem_assinatura
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
      ),
      receita_classificada AS (
        SELECT
          COUNT(*) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio = 1
          )::INT AS novos_negocios_pagantes,
          COALESCE(SUM(pc.valor) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio = 1
          ), 0)::NUMERIC(14,2)
            AS receita_primeira_conversao,
          COUNT(*) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura > 1
          )::INT AS pagamentos_renovacao,
          COUNT(DISTINCT pc.negocio_id) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura > 1
          )::INT AS negocios_com_renovacao,
          COALESCE(SUM(pc.valor) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura > 1
          ), 0)::NUMERIC(14,2)
            AS receita_renovacao,
          COUNT(*) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura = 1
          )::INT AS pagamentos_mudanca_plano,
          COUNT(DISTINCT pc.negocio_id) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura = 1
          )::INT AS negocios_com_mudanca_plano,
          COALESCE(SUM(pc.valor) FILTER (
            WHERE UPPER(pc.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
              AND pc.ordem_negocio > 1
              AND pc.ordem_assinatura = 1
          ), 0)::NUMERIC(14,2)
            AS receita_mudanca_plano
        FROM pagamentos_classificados pc
        WHERE 1 = 1
          ${filtroReceitaClassificada}
      ),
      cobrancas_ordenadas AS (
        SELECT
          pg.id,
          pg.assinatura_id,
          pg.asaas_payment_id,
          a.negocio_id,
          pg.status,
          pg.data_vencimento,
          pg.data_pagamento,
          ROW_NUMBER() OVER (
            PARTITION BY pg.assinatura_id
            ORDER BY
              COALESCE(
                pg.data_vencimento,
                pg.data_pagamento,
                pg.created_at::date
              ) ASC,
              pg.id ASC
          ) AS ordem_assinatura
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE pl.valor > 0
      ),
      cobrancas_recorrentes AS (
        SELECT
          co.*,
          EXISTS (
            SELECT 1
            FROM webhook_eventos we
            WHERE we.provedor = 'asaas'
              AND we.recurso_id =
                co.asaas_payment_id
              AND we.tipo_evento =
                'PAYMENT_OVERDUE'
              AND we.status = 'PROCESSED'
          ) AS atraso_observado
        FROM cobrancas_ordenadas co
        WHERE co.ordem_assinatura > 1
          AND co.data_vencimento IS NOT NULL
      ),
      retencao_financeira AS (
        SELECT
          COUNT(*)::INT AS renovacoes_previstas,
          COUNT(*) FILTER (
            WHERE UPPER(cr.status) IN (
              'CONFIRMED',
              'RECEIVED',
              'RECEIVED_IN_CASH'
            )
          )::INT AS renovacoes_confirmadas,
          COUNT(*) FILTER (
            WHERE cr.atraso_observado
              OR UPPER(cr.status) IN (
                'OVERDUE',
                'PAST_DUE',
                'PAYMENT_FAILED',
                'CREDIT_CARD_CAPTURE_REFUSED'
              )
          )::INT AS renovacoes_com_atraso,
          COUNT(*) FILTER (
            WHERE cr.atraso_observado
              AND UPPER(cr.status) IN (
                'CONFIRMED',
                'RECEIVED',
                'RECEIVED_IN_CASH'
              )
          )::INT AS renovacoes_recuperadas
        FROM cobrancas_recorrentes cr
        WHERE cr.data_vencimento <= CURRENT_DATE
          ${filtroRenovacaoVencimento}
      ),
      cancelamentos_agendados AS (
        SELECT COUNT(*)::INT
          AS cancelamentos_renovacao_agendados
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = TRUE
          AND UPPER(a.status) IN (
            'CANCELED',
            'CANCELLED'
          )
          AND pl.valor > 0
      ),
      cancelamentos_encerrados AS (
        SELECT COUNT(*)::INT
          AS assinaturas_encerradas_apos_cancelamento
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = FALSE
          AND UPPER(a.status) IN (
            'CANCELED',
            'CANCELLED'
          )
          AND pl.valor > 0
          AND COALESCE(a.observacoes, '') LIKE
            '%Renovação cancelada pelo titular.%'
          ${filtroEncerramentoCancelado}
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
        p.receita_bruta,
        p.pagamentos_em_reversao,
        p.valor_exposto_reversoes,
        fp.novas_assinaturas_pagas,
        fp.receita_primeiro_pagamento,
        rc.novos_negocios_pagantes,
        rc.receita_primeira_conversao,
        rc.pagamentos_renovacao,
        rc.negocios_com_renovacao,
        rc.receita_renovacao,
        rc.pagamentos_mudanca_plano,
        rc.negocios_com_mudanca_plano,
        rc.receita_mudanca_plano,
        rf.renovacoes_previstas,
        rf.renovacoes_confirmadas,
        rf.renovacoes_com_atraso,
        rf.renovacoes_recuperadas,
        ca.cancelamentos_renovacao_agendados,
        ce.assinaturas_encerradas_apos_cancelamento,
        a.assinaturas_pagas_ativas
      FROM checkouts c
      CROSS JOIN checkout_coorte cc
      CROSS JOIN pagamentos_resumo p
      CROSS JOIN primeiros_pagamentos fp
      CROSS JOIN receita_classificada rc
      CROSS JOIN retencao_financeira rf
      CROSS JOIN cancelamentos_agendados ca
      CROSS JOIN cancelamentos_encerrados ce
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

async function buscarReconciliacaoPipelines(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const filtroLegacy = filtroTimestamp(seguro, "ep.created_at");
  const filtroV2 = filtroTimestamp(seguro, "ae.occurred_at");

  const resultado = await db.query(
    `
    WITH primeiro_v2 AS (
      SELECT MIN(ae.occurred_at) AS inicio_comparavel
      FROM analytics_eventos ae
      WHERE ae.origem = 'frontend'
        AND ae.nome IN (
          'profile_viewed',
          'profile_shared',
          'booking_started',
          'booking_completed'
        )
        ${filtroV2}
    ),
    eventos_base(evento, ordem) AS (
      VALUES
        ('profile_viewed', 1),
        ('profile_shared', 2),
        ('booking_started', 3),
        ('booking_completed', 4)
    ),
    legado_periodo AS (
      SELECT
        CASE
          WHEN ep.nome = 'perfil_visualizado'
            THEN 'profile_viewed'
          WHEN ep.nome IN (
            'link_negocio_copiado',
            'link_negocio_compartilhado',
            'link_servico_copiado',
            'link_servico_compartilhado'
          )
            THEN 'profile_shared'
          WHEN ep.nome = 'agendamento_iniciado'
            THEN 'booking_started'
          WHEN ep.nome = 'agendamento_concluido'
            THEN 'booking_completed'
        END AS evento,
        COUNT(*)::INT AS eventos,
        COUNT(DISTINCT ep.sessao_id)::INT AS sessoes
      FROM eventos_produto ep
      WHERE ep.nome IN (
        'perfil_visualizado',
        'link_negocio_copiado',
        'link_negocio_compartilhado',
        'link_servico_copiado',
        'link_servico_compartilhado',
        'agendamento_iniciado',
        'agendamento_concluido'
      )
        ${filtroLegacy}
      GROUP BY 1
    ),
    v2_periodo AS (
      SELECT
        ae.nome AS evento,
        COUNT(*)::INT AS eventos,
        COUNT(DISTINCT ae.sessao_id)::INT AS sessoes,
        COUNT(*) FILTER (
          WHERE ae.nome = 'booking_completed'
            AND ae.agendamento_id IS NOT NULL
        )::INT AS booking_completed_vinculados
      FROM analytics_eventos ae
      WHERE ae.origem = 'frontend'
        AND ae.nome IN (
          'profile_viewed',
          'profile_shared',
          'booking_started',
          'booking_completed'
        )
        ${filtroV2}
      GROUP BY ae.nome
    ),
    legado_comparavel AS (
      SELECT
        CASE
          WHEN ep.nome = 'perfil_visualizado'
            THEN 'profile_viewed'
          WHEN ep.nome IN (
            'link_negocio_copiado',
            'link_negocio_compartilhado',
            'link_servico_copiado',
            'link_servico_compartilhado'
          )
            THEN 'profile_shared'
          WHEN ep.nome = 'agendamento_iniciado'
            THEN 'booking_started'
          WHEN ep.nome = 'agendamento_concluido'
            THEN 'booking_completed'
        END AS evento,
        COUNT(*)::INT AS eventos,
        COUNT(DISTINCT ep.sessao_id)::INT AS sessoes
      FROM eventos_produto ep
      CROSS JOIN primeiro_v2 p
      WHERE p.inicio_comparavel IS NOT NULL
        AND ep.created_at >= p.inicio_comparavel
        AND ep.nome IN (
          'perfil_visualizado',
          'link_negocio_copiado',
          'link_negocio_compartilhado',
          'link_servico_copiado',
          'link_servico_compartilhado',
          'agendamento_iniciado',
          'agendamento_concluido'
        )
      GROUP BY 1
    ),
    v2_comparavel AS (
      SELECT
        ae.nome AS evento,
        COUNT(*)::INT AS eventos,
        COUNT(DISTINCT ae.sessao_id)::INT AS sessoes,
        COUNT(*) FILTER (
          WHERE ae.nome = 'booking_completed'
            AND ae.agendamento_id IS NOT NULL
        )::INT AS booking_completed_vinculados
      FROM analytics_eventos ae
      CROSS JOIN primeiro_v2 p
      WHERE p.inicio_comparavel IS NOT NULL
        AND ae.occurred_at >= p.inicio_comparavel
        AND ae.origem = 'frontend'
        AND ae.nome IN (
          'profile_viewed',
          'profile_shared',
          'booking_started',
          'booking_completed'
        )
      GROUP BY ae.nome
    )
    SELECT
      eb.evento,
      p.inicio_comparavel,
      COALESCE(lp.eventos, 0)::INT AS legado_eventos_periodo,
      COALESCE(vp.eventos, 0)::INT AS v2_eventos_periodo,
      COALESCE(lp.sessoes, 0)::INT AS legado_sessoes_periodo,
      COALESCE(vp.sessoes, 0)::INT AS v2_sessoes_periodo,
      COALESCE(lc.eventos, 0)::INT AS legado_eventos_comparaveis,
      COALESCE(vc.eventos, 0)::INT AS v2_eventos_comparaveis,
      COALESCE(lc.sessoes, 0)::INT AS legado_sessoes_comparaveis,
      COALESCE(vc.sessoes, 0)::INT AS v2_sessoes_comparaveis,
      COALESCE(vc.booking_completed_vinculados, 0)::INT
        AS booking_completed_vinculados
    FROM eventos_base eb
    CROSS JOIN primeiro_v2 p
    LEFT JOIN legado_periodo lp
      ON lp.evento = eb.evento
    LEFT JOIN v2_periodo vp
      ON vp.evento = eb.evento
    LEFT JOIN legado_comparavel lc
      ON lc.evento = eb.evento
    LEFT JOIN v2_comparavel vc
      ON vc.evento = eb.evento
    ORDER BY eb.ordem
    `
  );

  return {
    periodo: seguro,
    inicioComparavel:
      resultado.rows[0]?.inicio_comparavel || null,
    eventos: resultado.rows,
  };
}

module.exports = {
  periodoSeguro,
  buscarVisaoGeral,
  listarAquisicao,
  buscarJornada,
  buscarReconciliacaoPipelines,
  buscarReceita,
};
