const db = require(
  "../db/db"
);

async function recuperarGoogleProfissionaisPorEventos({
  client = db,
  campanhaOficial,
}) {
  return client.query(
    `
    WITH evidencia_google AS (
      SELECT DISTINCT ON (e.usuario_id)
        e.usuario_id,
        e.sessao_id,
        u.created_at AS atribuicao_em,
        CASE
          WHEN LOWER(
            COALESCE(
              NULLIF(
                BTRIM(
                  e.propriedades ->> 'utm_campaign'
                ),
                ''
              ),
              ''
            )
          ) = $1
            THEN $1
          ELSE NULL
        END AS utm_campaign,
        NULLIF(
          BTRIM(e.propriedades ->> 'gclid'),
          ''
        ) AS gclid,
        NULLIF(
          BTRIM(e.propriedades ->> 'gbraid'),
          ''
        ) AS gbraid,
        NULLIF(
          BTRIM(e.propriedades ->> 'wbraid'),
          ''
        ) AS wbraid,
        CASE
          WHEN LEFT(
            COALESCE(
              e.propriedades ->> 'landing_page',
              ''
            ),
            1
          ) = '/'
            AND LEFT(
              COALESCE(
                e.propriedades ->> 'landing_page',
                ''
              ),
              2
            ) <> '//'
            AND POSITION(
              E'\\\\' IN COALESCE(
                e.propriedades ->> 'landing_page',
                ''
              )
            ) = 0
            THEN e.propriedades ->> 'landing_page'
          ELSE NULL
        END AS landing_page
      FROM eventos_produto e
      INNER JOIN usuarios u
        ON u.id = e.usuario_id
      INNER JOIN marketing_usuario_atribuicoes mua_existente
        ON mua_existente.usuario_id = e.usuario_id
       AND mua_existente.intencao = 'profissional'
      WHERE e.usuario_id IS NOT NULL
        AND e.created_at >=
          u.created_at - INTERVAL '5 minutes'
        AND e.created_at <=
          u.created_at + INTERVAL '24 hours'
        AND (
          COALESCE(
            NULLIF(BTRIM(e.propriedades ->> 'gclid'), ''),
            NULLIF(BTRIM(e.propriedades ->> 'gbraid'), ''),
            NULLIF(BTRIM(e.propriedades ->> 'wbraid'), '')
          ) IS NOT NULL
          OR (
            LOWER(
              COALESCE(
                e.propriedades ->> 'utm_source',
                ''
              )
            ) = 'google'
            AND LOWER(
              COALESCE(
                e.propriedades ->> 'utm_medium',
                ''
              )
            ) IN (
              'cpc',
              'ppc',
              'paid',
              'paid_search'
            )
            AND LOWER(
              COALESCE(
                e.propriedades ->> 'utm_campaign',
                ''
              )
            ) = $1
          )
        )
      ORDER BY
        e.usuario_id,
        e.created_at ASC,
        e.id ASC
    )
    UPDATE marketing_usuario_atribuicoes mua
    SET
      sessao_id = eg.sessao_id,
      utm_source = 'google',
      utm_medium = 'cpc',
      utm_campaign = eg.utm_campaign,
      gclid = eg.gclid,
      gbraid = eg.gbraid,
      wbraid = eg.wbraid,
      landing_page = eg.landing_page,
      last_utm_source = COALESCE(
        NULLIF(BTRIM(mua.last_utm_source), ''),
        'google'
      ),
      last_utm_medium = COALESCE(
        NULLIF(BTRIM(mua.last_utm_medium), ''),
        'cpc'
      ),
      last_utm_campaign = COALESCE(
        NULLIF(BTRIM(mua.last_utm_campaign), ''),
        eg.utm_campaign
      ),
      last_gclid = COALESCE(
        NULLIF(BTRIM(mua.last_gclid), ''),
        eg.gclid
      ),
      last_gbraid = COALESCE(
        NULLIF(BTRIM(mua.last_gbraid), ''),
        eg.gbraid
      ),
      last_wbraid = COALESCE(
        NULLIF(BTRIM(mua.last_wbraid), ''),
        eg.wbraid
      ),
      last_landing_page = COALESCE(
        NULLIF(BTRIM(mua.last_landing_page), ''),
        eg.landing_page
      ),
      atribuicao_em = LEAST(
        mua.atribuicao_em,
        eg.atribuicao_em
      ),
      updated_at = NOW()
    FROM evidencia_google eg
    WHERE mua.usuario_id = eg.usuario_id
      AND COALESCE(
        NULLIF(BTRIM(mua.utm_source), ''),
        NULLIF(BTRIM(mua.utm_medium), ''),
        NULLIF(BTRIM(mua.utm_campaign), ''),
        NULLIF(BTRIM(mua.gclid), ''),
        NULLIF(BTRIM(mua.gbraid), ''),
        NULLIF(BTRIM(mua.wbraid), ''),
        NULLIF(BTRIM(mua.fbclid), ''),
        NULLIF(BTRIM(mua.msclkid), ''),
        NULLIF(BTRIM(mua.ttclid), ''),
        NULLIF(BTRIM(mua.epik), '')
      ) IS NULL
    `,
    [campanhaOficial]
  );
}

module.exports = {
  recuperarGoogleProfissionaisPorEventos,
};
