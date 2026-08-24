const db = require("../db/db");

const PERIODOS = new Set([
  "hoje",
  "7dias",
  "30dias",
  "mes",
]);

function periodoSeguro(valor) {
  const periodo = String(valor || "7dias").trim().toLowerCase();
  return PERIODOS.has(periodo) ? periodo : "7dias";
}

async function buscarOrigemClientes(
  negocioId,
  periodo = "7dias"
) {
  const periodoNormalizado = periodoSeguro(periodo);

  const result = await db.query(
    `
    WITH parametros AS (
      SELECT
        (NOW() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje,
        CASE $2::text
          WHEN 'hoje' THEN
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
          WHEN '30dias' THEN
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 29
          WHEN 'mes' THEN
            date_trunc(
              'month',
              (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
            )::date
          ELSE
            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 6
        END AS inicio
    ),
    agendamentos_validos AS (
      SELECT
        a.id,
        a.data,
        a.horario,
        a.valor_servico,
        a.servico_id,
        COALESCE(
          'usuario:' || a.cliente_id::text,
          'whatsapp:' || NULLIF(
            regexp_replace(
              COALESCE(a.cliente_whatsapp, ''),
              '[^0-9]',
              '',
              'g'
            ),
            ''
          )
        ) AS cliente_chave
      FROM agendamentos a
      WHERE a.negocio_id = $1
        AND a.status != 'cancelado'
    ),
    clientes_validos AS (
      SELECT *
      FROM agendamentos_validos
      WHERE cliente_chave IS NOT NULL
    ),
    primeira_visita AS (
      SELECT DISTINCT ON (cliente_chave)
        cliente_chave,
        id AS primeiro_agendamento_id,
        data AS primeira_data
      FROM clientes_validos
      ORDER BY
        cliente_chave,
        data ASC,
        horario ASC,
        id ASC
    ),
    clientes_periodo AS (
      SELECT
        a.cliente_chave,
        pv.primeira_data,
        pv.primeiro_agendamento_id,
        COUNT(a.id)::int AS agendamentos,
        COALESCE(
          SUM(
            COALESCE(
              a.valor_servico,
              s.valor,
              0
            )
          ),
          0
        )::numeric AS faturamento
      FROM clientes_validos a
      INNER JOIN primeira_visita pv
        ON pv.cliente_chave = a.cliente_chave
      LEFT JOIN servicos_negocio s
        ON s.id = a.servico_id
      CROSS JOIN parametros p
      WHERE a.data BETWEEN p.inicio AND p.hoje
      GROUP BY
        a.cliente_chave,
        pv.primeira_data,
        pv.primeiro_agendamento_id
    ),
    clientes_com_origem AS (
      SELECT
        cp.*,
        ev.id IS NOT NULL AS evento_encontrado,
        LOWER(NULLIF(BTRIM(ev.propriedades ->> 'utm_source'), '')) AS utm_source,
        LOWER(NULLIF(BTRIM(ev.propriedades ->> 'utm_medium'), '')) AS utm_medium,
        NULLIF(BTRIM(ev.propriedades ->> 'utm_campaign'), '') AS utm_campaign,
        NULLIF(BTRIM(ev.propriedades ->> 'gclid'), '') AS gclid,
        NULLIF(BTRIM(ev.propriedades ->> 'gbraid'), '') AS gbraid,
        NULLIF(BTRIM(ev.propriedades ->> 'wbraid'), '') AS wbraid,
        NULLIF(BTRIM(ev.propriedades ->> 'fbclid'), '') AS fbclid,
        NULLIF(BTRIM(ev.propriedades ->> 'msclkid'), '') AS msclkid,
        NULLIF(BTRIM(ev.propriedades ->> 'ttclid'), '') AS ttclid,
        NULLIF(BTRIM(ev.propriedades ->> 'epik'), '') AS epik,
        LOWER(
          NULLIF(BTRIM(ev.propriedades ->> 'referrer_host'), '')
        ) AS referrer_host,
        p.inicio
      FROM clientes_periodo cp
      CROSS JOIN parametros p
      LEFT JOIN LATERAL (
        SELECT
          e.id,
          e.propriedades
        FROM eventos_produto e
        WHERE e.negocio_id = $1
          AND e.nome = 'agendamento_concluido'
          AND NULLIF(
            BTRIM(e.propriedades ->> 'agendamento_id'),
            ''
          ) ~ '^[0-9]+$'
          AND (
            e.propriedades ->> 'agendamento_id'
          )::bigint = cp.primeiro_agendamento_id
        ORDER BY e.created_at ASC, e.id ASC
        LIMIT 1
      ) ev ON TRUE
    ),
    classificados AS (
      SELECT
        *,
        CASE
          WHEN gclid IS NOT NULL
            OR gbraid IS NOT NULL
            OR wbraid IS NOT NULL
            THEN 'google_ads'
          WHEN msclkid IS NOT NULL
            THEN 'microsoft_ads'
          WHEN utm_source = 'google'
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_search'
            )
            THEN 'google_ads'
          WHEN utm_source IN ('bing', 'microsoft')
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_search'
            )
            THEN 'microsoft_ads'
          WHEN utm_source IN ('meta', 'facebook', 'instagram')
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_social', 'social_paid'
            )
            THEN 'meta_ads'
          WHEN utm_source = 'tiktok'
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_social', 'social_paid'
            )
            THEN 'tiktok_ads'
          WHEN utm_source = 'pinterest'
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_social', 'social_paid'
            )
            THEN 'pinterest_ads'
          WHEN ttclid IS NOT NULL
            THEN 'tiktok_ads'
          WHEN epik IS NOT NULL
            AND utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_social', 'social_paid'
            )
            THEN 'pinterest_ads'
          WHEN utm_medium IN (
              'cpc', 'ppc', 'paid', 'paid_search',
              'paid_social', 'social_paid', 'display'
            )
            THEN 'outra_midia_paga'

          WHEN utm_source = 'google'
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'seo')
            THEN 'google_organico'
          WHEN utm_source IN ('bing', 'microsoft')
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'seo')
            THEN 'bing_organico'
          WHEN utm_source = 'instagram'
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'social', 'organic_social')
            THEN 'instagram_organico'
          WHEN utm_source IN ('facebook', 'meta')
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'social', 'organic_social')
            THEN 'facebook_organico'
          WHEN utm_source = 'tiktok'
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'social', 'organic_social')
            THEN 'tiktok_organico'
          WHEN utm_source = 'pinterest'
            AND utm_medium IN ('organic', 'organico', 'orgânico', 'social', 'organic_social')
            THEN 'pinterest_organico'

          WHEN referrer_host ~ '(^|\\.)google\\.'
            THEN 'google_organico'
          WHEN referrer_host ~ '(^|\\.)bing\\.'
            THEN 'bing_organico'
          WHEN referrer_host ~ '(^|\\.)duckduckgo\\.'
            THEN 'duckduckgo_organico'
          WHEN referrer_host ~ '(^|\\.)yahoo\\.'
            THEN 'yahoo_organico'
          WHEN referrer_host ~ '(^|\\.)instagram\\.'
            THEN 'instagram_organico'
          WHEN referrer_host ~ '(^|\\.)facebook\\.'
            THEN 'facebook_organico'
          WHEN referrer_host ~ '(^|\\.)tiktok\\.'
            THEN 'tiktok_organico'
          WHEN referrer_host ~ '(^|\\.)pinterest\\.'
            THEN 'pinterest_organico'
          WHEN fbclid IS NOT NULL
            THEN 'meta_organico'
          WHEN referrer_host IS NOT NULL
            THEN 'referencia_externa'
          WHEN utm_source IS NOT NULL
            OR utm_medium IS NOT NULL
            OR utm_campaign IS NOT NULL
            THEN 'outra_origem_rastreada'
          WHEN evento_encontrado THEN 'autonomo'
          ELSE 'nao_identificado'
        END AS origem_codigo
      FROM clientes_com_origem
    )
    SELECT
      origem_codigo,
      COUNT(*)::int AS clientes,
      COUNT(*) FILTER (
        WHERE primeira_data >= inicio
      )::int AS clientes_novos,
      COUNT(*) FILTER (
        WHERE primeira_data < inicio
      )::int AS clientes_recorrentes,
      COALESCE(SUM(agendamentos), 0)::int AS agendamentos,
      COALESCE(SUM(faturamento), 0)::numeric AS faturamento
    FROM classificados
    GROUP BY origem_codigo
    ORDER BY
      clientes DESC,
      agendamentos DESC,
      origem_codigo ASC
    `,
    [negocioId, periodoNormalizado]
  );

  return result.rows;
}

module.exports = {
  buscarOrigemClientes,
  periodoSeguro,
};
