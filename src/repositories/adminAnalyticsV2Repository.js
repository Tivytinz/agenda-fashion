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
    negocios AS (
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
    agendamentos AS (
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
    pagamentos AS (
      SELECT
        COUNT(*)::INT AS pagamentos_confirmados,
        COUNT(DISTINCT a.negocio_id)::INT AS negocios_com_pagamento,
        COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_confirmada
      FROM pagamentos pg
      INNER JOIN assinaturas a
        ON a.id = pg.assinatura_id
      INNER JOIN planos pl
        ON pl.id = a.plano_id
      WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED')
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
    CROSS JOIN negocios n
    CROSS JOIN publicados pub
    CROSS JOIN agendamentos ag
    CROSS JOIN primeiros_agendamentos pa
    CROSS JOIN pagamentos pg
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
      pagamentos AS (
        SELECT
          COUNT(*)::INT AS pagamentos_confirmados,
          COUNT(DISTINCT a.negocio_id)::INT AS negocios_pagantes,
          COALESCE(SUM(pg.valor), 0)::NUMERIC(14,2) AS receita_total
        FROM pagamentos pg
        INNER JOIN assinaturas a
          ON a.id = pg.assinatura_id
        INNER JOIN planos pl
          ON pl.id = a.plano_id
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED')
          AND pg.data_pagamento IS NOT NULL
          AND pl.valor > 0
          ${filtroPagamento}
      ),
      primeiros AS (
        SELECT DISTINCT ON (pg.assinatura_id)
          pg.assinatura_id,
          pg.id AS pagamento_id
        FROM pagamentos pg
        WHERE UPPER(pg.status) IN ('CONFIRMED', 'RECEIVED')
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
        p.pagamentos_confirmados,
        p.negocios_pagantes,
        p.receita_total,
        fp.novas_assinaturas_pagas,
        fp.receita_primeiro_pagamento,
        a.assinaturas_pagas_ativas
      FROM checkouts c
      CROSS JOIN pagamentos p
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
