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
  const filtroLifecycle = filtroTimestamp(
    seguro,
    "ae.ocorrido_em"
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
          AND NOT (
            a.data_proxima_cobranca IS NOT NULL
            AND a.data_proxima_cobranca <= CURRENT_DATE
          )
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
      cancelamentos_vencidos_pendentes AS (
        SELECT COUNT(*)::INT
          AS cancelamentos_vencidos_pendentes_reconciliacao
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = TRUE
          AND UPPER(a.status) IN (
            'CANCELED',
            'CANCELLED'
          )
          AND a.data_proxima_cobranca IS NOT NULL
          AND a.data_proxima_cobranca <= CURRENT_DATE
          AND pl.valor > 0
      ),
      lifecycle_eventos AS (
        SELECT
          COUNT(*) FILTER (
            WHERE ae.tipo = 'CONVERSAO_INICIAL'
          )::INT AS conversoes_iniciais_canonicas,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'RENOVACAO_CONFIRMADA'
          )::INT AS renovacoes_confirmadas_canonicas,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'REATIVACAO_PAGA'
          )::INT AS reativacoes_pagas,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'PLANO_ALTERADO'
          )::INT AS mudancas_plano_canonicas,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'PAGAMENTO_ATRASADO'
          )::INT AS pagamentos_atrasados_canonicos,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'PAGAMENTO_RECUPERADO'
          )::INT AS pagamentos_recuperados_canonicos,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'REVERSAO_FINANCEIRA'
          )::INT AS reversoes_financeiras_canonicas,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'RENOVACAO_CANCELADA'
          )::INT AS cancelamentos_renovacao_canonicos,
          COUNT(*) FILTER (
            WHERE ae.tipo = 'ACESSO_PAGO_ENCERRADO'
          )::INT AS saidas_base_paga_canonicas
        FROM assinatura_eventos ae
        WHERE 1 = 1
          ${filtroLifecycle}
      ),
      ativas AS (
        SELECT COUNT(*)::INT AS assinaturas_pagas_ativas
        FROM assinaturas a
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE a.ativo = TRUE
          AND pl.valor > 0
          AND NOT (
            UPPER(a.status) IN (
              'CANCELED',
              'CANCELLED'
            )
            AND a.data_proxima_cobranca IS NOT NULL
            AND a.data_proxima_cobranca <= CURRENT_DATE
          )
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
        cvp.cancelamentos_vencidos_pendentes_reconciliacao,
        le.conversoes_iniciais_canonicas,
        le.renovacoes_confirmadas_canonicas,
        le.reativacoes_pagas,
        le.mudancas_plano_canonicas,
        le.pagamentos_atrasados_canonicos,
        le.pagamentos_recuperados_canonicos,
        le.reversoes_financeiras_canonicas,
        le.cancelamentos_renovacao_canonicos,
        le.saidas_base_paga_canonicas,
        a.assinaturas_pagas_ativas
      FROM checkouts c
      CROSS JOIN checkout_coorte cc
      CROSS JOIN pagamentos_resumo p
      CROSS JOIN primeiros_pagamentos fp
      CROSS JOIN receita_classificada rc
      CROSS JOIN retencao_financeira rf
      CROSS JOIN cancelamentos_agendados ca
      CROSS JOIN cancelamentos_encerrados ce
      CROSS JOIN cancelamentos_vencidos_pendentes cvp
      CROSS JOIN lifecycle_eventos le
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
        AND NOT (
          UPPER(a.status) IN (
            'CANCELED',
            'CANCELLED'
          )
          AND a.data_proxima_cobranca IS NOT NULL
          AND a.data_proxima_cobranca <= CURRENT_DATE
        )
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

async function buscarChurnPago(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const inicioSolicitado = inicioTimestampSql(seguro);
  const inicioEfetivoSql = inicioSolicitado
    ? `GREATEST(m.inicio_cobertura, ${inicioSolicitado})`
    : "m.inicio_cobertura";
  const ajustadoSql = inicioSolicitado
    ? `(${inicioSolicitado} < m.inicio_cobertura)`
    : "TRUE";

  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em AS inicio_cobertura
      FROM financeiro_marcos
      WHERE chave = 'churn_v1_inicio'
      LIMIT 1
    ),
    limites AS (
      SELECT
        m.inicio_cobertura,
        ${inicioEfetivoSql} AS inicio_efetivo,
        NOW() AS fim_efetivo,
        ${ajustadoSql} AS periodo_ajustado_cutover
      FROM marco m
    ),
    fronteiras AS (
      SELECT
        ae.id,
        ae.negocio_id,
        ae.tipo,
        ae.motivo,
        ae.ocorrido_em,
        CASE
          WHEN ae.tipo = 'ACESSO_PAGO_ENCERRADO'
            THEN 'fim'
          ELSE 'inicio'
        END AS movimento
      FROM assinatura_eventos ae
      CROSS JOIN limites l
      WHERE ae.ocorrido_em >= l.inicio_cobertura
        AND ae.tipo IN (
          'EPISODIO_PAGO_BASELINE',
          'CONVERSAO_INICIAL',
          'REATIVACAO_PAGA',
          'ACESSO_PAGO_ENCERRADO'
        )
    ),
    estado_inicio_ranqueado AS (
      SELECT
        f.*,
        ROW_NUMBER() OVER (
          PARTITION BY f.negocio_id
          ORDER BY
            f.ocorrido_em DESC,
            f.id DESC
        ) AS rn
      FROM fronteiras f
      CROSS JOIN limites l
      WHERE f.ocorrido_em <= l.inicio_efetivo
    ),
    base_inicio AS (
      SELECT negocio_id
      FROM estado_inicio_ranqueado
      WHERE rn = 1
        AND movimento = 'inicio'
    ),
    saidas_base AS (
      SELECT DISTINCT ON (f.negocio_id)
        f.negocio_id,
        f.motivo,
        f.ocorrido_em
      FROM fronteiras f
      INNER JOIN base_inicio bi
        ON bi.negocio_id = f.negocio_id
      CROSS JOIN limites l
      WHERE f.movimento = 'fim'
        AND f.ocorrido_em > l.inicio_efetivo
        AND f.ocorrido_em <= l.fim_efetivo
      ORDER BY
        f.negocio_id,
        f.ocorrido_em ASC,
        f.id ASC
    ),
    estado_fim_ranqueado AS (
      SELECT
        f.*,
        ROW_NUMBER() OVER (
          PARTITION BY f.negocio_id
          ORDER BY
            f.ocorrido_em DESC,
            f.id DESC
        ) AS rn
      FROM fronteiras f
      CROSS JOIN limites l
      WHERE f.ocorrido_em <= l.fim_efetivo
    ),
    base_fim AS (
      SELECT negocio_id
      FROM estado_fim_ranqueado
      WHERE rn = 1
        AND movimento = 'inicio'
    ),
    reativacoes AS (
      SELECT COUNT(DISTINCT ae.negocio_id)::INT
        AS negocios_reativados
      FROM assinatura_eventos ae
      CROSS JOIN limites l
      WHERE ae.tipo = 'REATIVACAO_PAGA'
        AND ae.ocorrido_em > l.inicio_efetivo
        AND ae.ocorrido_em <= l.fim_efetivo
    )
    SELECT
      l.inicio_cobertura,
      l.inicio_efetivo,
      l.periodo_ajustado_cutover,
      (SELECT COUNT(*)::INT FROM base_inicio)
        AS base_paga_inicio,
      (SELECT COUNT(*)::INT FROM saidas_base)
        AS saidas_terminais_base_inicial,
      (SELECT COUNT(*)::INT FROM base_fim)
        AS base_paga_fim,
      r.negocios_reativados,
      COUNT(*) FILTER (
        WHERE sb.motivo = 'CANCELAMENTO_VOLUNTARIO'
      )::INT AS saidas_cancelamento_voluntario,
      COUNT(*) FILTER (
        WHERE sb.motivo = 'INADIMPLENCIA_NAO_RECUPERADA'
      )::INT AS saidas_inadimplencia_nao_recuperada,
      COUNT(*) FILTER (
        WHERE sb.motivo = 'ENCERRAMENTO_PROVEDOR'
      )::INT AS saidas_encerramento_provedor,
      COUNT(*) FILTER (
        WHERE sb.motivo NOT IN (
          'CANCELAMENTO_VOLUNTARIO',
          'INADIMPLENCIA_NAO_RECUPERADA',
          'ENCERRAMENTO_PROVEDOR'
        )
        OR sb.motivo IS NULL
      )::INT AS saidas_outros_motivos
    FROM limites l
    CROSS JOIN reativacoes r
    LEFT JOIN saidas_base sb
      ON TRUE
    GROUP BY
      l.inicio_cobertura,
      l.inicio_efetivo,
      l.periodo_ajustado_cutover,
      r.negocios_reativados
    `
  );

  return {
    periodo: seguro,
    ...(resultado.rows[0] || {}),
  };
}

async function buscarMrr(periodo = "30") {
  const seguro = periodoSeguro(periodo);
  const inicioSolicitado = inicioTimestampSql(seguro);
  const inicioEfetivoSql = inicioSolicitado
    ? `GREATEST(m.inicio_cobertura, ${inicioSolicitado})`
    : "m.inicio_cobertura";
  const ajustadoSql = inicioSolicitado
    ? `(${inicioSolicitado} < m.inicio_cobertura)`
    : "TRUE";

  const resultado = await db.query(
    `
    WITH marco AS (
      SELECT ocorrido_em AS inicio_cobertura
      FROM financeiro_marcos
      WHERE chave = 'mrr_v1_inicio'
      LIMIT 1
    ),
    limites AS (
      SELECT
        m.inicio_cobertura,
        ${inicioEfetivoSql} AS inicio_efetivo,
        NOW() AS fim_efetivo,
        ${ajustadoSql} AS periodo_ajustado_cutover
      FROM marco m
    ),
    eventos_mrr AS (
      SELECT
        ae.id,
        ae.negocio_id,
        ae.tipo,
        ae.motivo,
        ae.valor_mensal_anterior,
        ae.valor_mensal_novo,
        ae.periodicidade_snapshot,
        ae.ocorrido_em
      FROM assinatura_eventos ae
      CROSS JOIN limites l
      WHERE ae.ocorrido_em >= l.inicio_cobertura
        AND ae.periodicidade_snapshot = 'MONTHLY'
        AND (
          ae.valor_mensal_anterior IS NOT NULL
          OR ae.valor_mensal_novo IS NOT NULL
        )
    ),
    estado_inicio_ranqueado AS (
      SELECT
        em.*,
        ROW_NUMBER() OVER (
          PARTITION BY em.negocio_id
          ORDER BY
            em.ocorrido_em DESC,
            em.id DESC
        ) AS rn
      FROM eventos_mrr em
      CROSS JOIN limites l
      WHERE em.ocorrido_em <= l.inicio_efetivo
    ),
    base_inicio AS (
      SELECT
        negocio_id,
        valor_mensal_novo AS mrr_inicio
      FROM estado_inicio_ranqueado
      WHERE rn = 1
        AND valor_mensal_novo > 0
    ),
    movimentos AS (
      SELECT
        em.*,
        (bi.negocio_id IS NOT NULL) AS pertence_base_inicial
      FROM eventos_mrr em
      CROSS JOIN limites l
      LEFT JOIN base_inicio bi
        ON bi.negocio_id = em.negocio_id
      WHERE em.ocorrido_em > l.inicio_efetivo
        AND em.ocorrido_em <= l.fim_efetivo
    ),
    estado_fim_ranqueado AS (
      SELECT
        em.*,
        ROW_NUMBER() OVER (
          PARTITION BY em.negocio_id
          ORDER BY
            em.ocorrido_em DESC,
            em.id DESC
        ) AS rn
      FROM eventos_mrr em
      CROSS JOIN limites l
      WHERE em.ocorrido_em <= l.fim_efetivo
    ),
    estado_fim AS (
      SELECT
        negocio_id,
        valor_mensal_novo AS mrr_fim
      FROM estado_fim_ranqueado
      WHERE rn = 1
    ),
    saidas_coorte AS (
      SELECT DISTINCT m.negocio_id
      FROM movimentos m
      WHERE m.pertence_base_inicial = TRUE
        AND m.tipo = 'ACESSO_PAGO_ENCERRADO'
    ),
    retencao_bruta AS (
      SELECT
        bi.negocio_id,
        bi.mrr_inicio,
        CASE
          WHEN sc.negocio_id IS NOT NULL THEN 0::NUMERIC
          ELSE LEAST(
            bi.mrr_inicio,
            GREATEST(
              COALESCE(ef.mrr_fim, 0),
              0
            )
          )
        END AS mrr_retido_bruto
      FROM base_inicio bi
      LEFT JOIN estado_fim ef
        ON ef.negocio_id = bi.negocio_id
      LEFT JOIN saidas_coorte sc
        ON sc.negocio_id = bi.negocio_id
    ),
    ultimo_estado_risco AS (
      SELECT *
      FROM (
        SELECT
          ae.negocio_id,
          ae.tipo,
          ae.detalhes,
          ROW_NUMBER() OVER (
            PARTITION BY ae.negocio_id
            ORDER BY
              ae.ocorrido_em DESC,
              ae.id DESC
          ) AS rn
        FROM assinatura_eventos ae
        CROSS JOIN limites l
        WHERE ae.ocorrido_em >= l.inicio_cobertura
          AND ae.tipo IN (
            'MRR_BASELINE',
            'CONVERSAO_INICIAL',
            'RENOVACAO_CONFIRMADA',
            'PAGAMENTO_ATRASADO',
            'PAGAMENTO_RECUPERADO',
            'REVERSAO_FINANCEIRA',
            'ACESSO_PAGO_ENCERRADO',
            'REATIVACAO_PAGA'
          )
      ) ordenado
      WHERE rn = 1
    ),
    risco_atual AS (
      SELECT
        COUNT(*)::INT AS negocios_mrr_em_risco,
        COALESCE(
          SUM(ef.mrr_fim),
          0
        )::NUMERIC(14,2) AS mrr_em_risco
      FROM estado_fim ef
      INNER JOIN ultimo_estado_risco ur
        ON ur.negocio_id = ef.negocio_id
      WHERE ef.mrr_fim > 0
        AND (
          ur.tipo IN (
            'PAGAMENTO_ATRASADO',
            'REVERSAO_FINANCEIRA'
          )
          OR (
            ur.tipo = 'MRR_BASELINE'
            AND COALESCE(
              (
                ur.detalhes
                  ->> 'mrr_em_risco_snapshot'
              )::boolean,
              FALSE
            )
          )
        )
    ),
    periodicidade_nao_suportada AS (
      SELECT COUNT(*)::INT AS total
      FROM assinaturas a
      INNER JOIN planos pl
        ON pl.id = a.plano_id
      WHERE a.ativo = TRUE
        AND pl.valor > 0
        AND COALESCE(
          NULLIF(
            UPPER(TRIM(a.periodicidade)),
            ''
          ),
          'MONTHLY'
        ) <> 'MONTHLY'
    ),
    bridge AS (
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo = 'CONVERSAO_INICIAL'
                AND m.pertence_base_inicial = FALSE
                THEN m.valor_mensal_novo
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2) AS new_mrr,
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo = 'REATIVACAO_PAGA'
                THEN m.valor_mensal_novo
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2) AS reactivation_mrr,
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo IN (
                'PLANO_ALTERADO',
                'VALOR_RECORRENTE_ALTERADO'
              )
                AND m.valor_mensal_anterior IS NOT NULL
                AND m.valor_mensal_novo IS NOT NULL
                AND m.valor_mensal_novo >
                  m.valor_mensal_anterior
                THEN
                  m.valor_mensal_novo -
                  m.valor_mensal_anterior
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2) AS expansion_mrr,
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo IN (
                'PLANO_ALTERADO',
                'VALOR_RECORRENTE_ALTERADO'
              )
                AND m.valor_mensal_anterior IS NOT NULL
                AND m.valor_mensal_novo IS NOT NULL
                AND m.valor_mensal_novo <
                  m.valor_mensal_anterior
                THEN
                  m.valor_mensal_anterior -
                  m.valor_mensal_novo
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2) AS contraction_mrr,
        COALESCE(
          SUM(
            CASE
              WHEN m.tipo = 'ACESSO_PAGO_ENCERRADO'
                THEN m.valor_mensal_anterior
              ELSE 0
            END
          ),
          0
        )::NUMERIC(14,2) AS churned_mrr
      FROM movimentos m
    )
    SELECT
      l.inicio_cobertura,
      l.inicio_efetivo,
      l.periodo_ajustado_cutover,
      COALESCE(
        (
          SELECT SUM(mrr_inicio)
          FROM base_inicio
        ),
        0
      )::NUMERIC(14,2) AS mrr_inicial,
      COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN ef.mrr_fim > 0
                THEN ef.mrr_fim
              ELSE 0
            END
          )
          FROM estado_fim ef
          INNER JOIN base_inicio bi
            ON bi.negocio_id = ef.negocio_id
        ),
        0
      )::NUMERIC(14,2) AS mrr_final_coorte_inicial,
      COALESCE(
        (
          SELECT SUM(
            CASE
              WHEN mrr_fim > 0
                THEN mrr_fim
              ELSE 0
            END
          )
          FROM estado_fim
        ),
        0
      )::NUMERIC(14,2) AS mrr_final_total,
      COALESCE(
        (
          SELECT SUM(mrr_retido_bruto)
          FROM retencao_bruta
        ),
        0
      )::NUMERIC(14,2) AS mrr_retido_bruto,
      b.new_mrr,
      b.reactivation_mrr,
      b.expansion_mrr,
      b.contraction_mrr,
      b.churned_mrr,
      ra.negocios_mrr_em_risco,
      ra.mrr_em_risco,
      pns.total
        AS assinaturas_periodicidade_nao_suportada
    FROM limites l
    CROSS JOIN bridge b
    CROSS JOIN risco_atual ra
    CROSS JOIN periodicidade_nao_suportada pns
    `
  );

  return {
    periodo: seguro,
    ...(resultado.rows[0] || {}),
  };
}

module.exports = {
  periodoSeguro,
  buscarVisaoGeral,
  listarAquisicao,
  buscarJornada,
  buscarReconciliacaoPipelines,
  buscarReceita,
  buscarChurnPago,
  buscarMrr,
};
