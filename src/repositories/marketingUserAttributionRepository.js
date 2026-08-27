const db = require(
  "../db/db"
);

async function registrarConta({
  usuarioId,
  intencao,
  sessaoId,
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  utmTerm,
  gclid,
  gbraid,
  wbraid,
  fbclid,
  msclkid,
  ttclid,
  epik,
  afSource,
  afMedium,
  afContent,
  landingPage,
  lastUtmSource,
  lastUtmMedium,
  lastUtmCampaign,
  lastUtmContent,
  lastUtmTerm,
  lastGclid,
  lastGbraid,
  lastWbraid,
  lastFbclid,
  lastMsclkid,
  lastTtclid,
  lastEpik,
  lastAfSource,
  lastAfMedium,
  lastAfContent,
  lastLandingPage,
}) {
  const resultado =
    await db.query(
      `
      INSERT INTO marketing_usuario_atribuicoes (
        usuario_id,
        intencao,
        sessao_id,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        gclid,
        gbraid,
        wbraid,
        fbclid,
        msclkid,
        ttclid,
        epik,
        af_source,
        af_medium,
        af_content,
        landing_page,
        last_utm_source,
        last_utm_medium,
        last_utm_campaign,
        last_utm_content,
        last_utm_term,
        last_gclid,
        last_gbraid,
        last_wbraid,
        last_fbclid,
        last_msclkid,
        last_ttclid,
        last_epik,
        last_af_source,
        last_af_medium,
        last_af_content,
        last_landing_page,
        atribuicao_em
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, NOW()
      )
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        intencao = CASE
          WHEN marketing_usuario_atribuicoes.intencao = 'profissional'
            OR EXCLUDED.intencao = 'profissional'
            THEN 'profissional'
          WHEN marketing_usuario_atribuicoes.intencao = 'indefinida'
            THEN EXCLUDED.intencao
          ELSE marketing_usuario_atribuicoes.intencao
        END,
        sessao_id = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.sessao_id), ''),
          EXCLUDED.sessao_id
        ),
        utm_source = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.utm_source), ''),
          EXCLUDED.utm_source
        ),
        utm_medium = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.utm_medium), ''),
          EXCLUDED.utm_medium
        ),
        utm_campaign = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.utm_campaign), ''),
          EXCLUDED.utm_campaign
        ),
        utm_content = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.utm_content), ''),
          EXCLUDED.utm_content
        ),
        utm_term = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.utm_term), ''),
          EXCLUDED.utm_term
        ),
        gclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.gclid), ''),
          EXCLUDED.gclid
        ),
        gbraid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.gbraid), ''),
          EXCLUDED.gbraid
        ),
        wbraid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.wbraid), ''),
          EXCLUDED.wbraid
        ),
        fbclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.fbclid), ''),
          EXCLUDED.fbclid
        ),
        msclkid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.msclkid), ''),
          EXCLUDED.msclkid
        ),
        ttclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.ttclid), ''),
          EXCLUDED.ttclid
        ),
        epik = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.epik), ''),
          EXCLUDED.epik
        ),
        af_source = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.af_source), ''),
          EXCLUDED.af_source
        ),
        af_medium = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.af_medium), ''),
          EXCLUDED.af_medium
        ),
        af_content = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.af_content), ''),
          EXCLUDED.af_content
        ),
        landing_page = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.landing_page), ''),
          EXCLUDED.landing_page
        ),
        last_utm_source = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_utm_source), ''),
          EXCLUDED.last_utm_source
        ),
        last_utm_medium = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_utm_medium), ''),
          EXCLUDED.last_utm_medium
        ),
        last_utm_campaign = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_utm_campaign), ''),
          EXCLUDED.last_utm_campaign
        ),
        last_utm_content = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_utm_content), ''),
          EXCLUDED.last_utm_content
        ),
        last_utm_term = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_utm_term), ''),
          EXCLUDED.last_utm_term
        ),
        last_gclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_gclid), ''),
          EXCLUDED.last_gclid
        ),
        last_gbraid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_gbraid), ''),
          EXCLUDED.last_gbraid
        ),
        last_wbraid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_wbraid), ''),
          EXCLUDED.last_wbraid
        ),
        last_fbclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_fbclid), ''),
          EXCLUDED.last_fbclid
        ),
        last_msclkid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_msclkid), ''),
          EXCLUDED.last_msclkid
        ),
        last_ttclid = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_ttclid), ''),
          EXCLUDED.last_ttclid
        ),
        last_epik = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_epik), ''),
          EXCLUDED.last_epik
        ),
        last_af_source = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_af_source), ''),
          EXCLUDED.last_af_source
        ),
        last_af_medium = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_af_medium), ''),
          EXCLUDED.last_af_medium
        ),
        last_af_content = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_af_content), ''),
          EXCLUDED.last_af_content
        ),
        last_landing_page = COALESCE(
          NULLIF(BTRIM(marketing_usuario_atribuicoes.last_landing_page), ''),
          EXCLUDED.last_landing_page
        ),
        atribuicao_em = LEAST(
          marketing_usuario_atribuicoes.atribuicao_em,
          EXCLUDED.atribuicao_em
        ),
        updated_at = NOW()
      RETURNING *
      `,
      [
        usuarioId,
        intencao,
        sessaoId,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        gclid,
        gbraid,
        wbraid,
        fbclid,
        msclkid,
        ttclid,
        epik,
        afSource,
        afMedium,
        afContent,
        landingPage,
        lastUtmSource || utmSource,
        lastUtmMedium || utmMedium,
        lastUtmCampaign || utmCampaign,
        lastUtmContent || utmContent,
        lastUtmTerm || utmTerm,
        lastGclid || gclid,
        lastGbraid || gbraid,
        lastWbraid || wbraid,
        lastFbclid || fbclid,
        lastMsclkid || msclkid,
        lastTtclid || ttclid,
        lastEpik || epik,
        lastAfSource || afSource,
        lastAfMedium || afMedium,
        lastAfContent || afContent,
        lastLandingPage || landingPage,
      ]
    );

  return resultado.rows[0] || null;
}

async function marcarIntencaoProfissional(
  usuarioId
) {
  const resultado =
    await db.query(
      `
      INSERT INTO marketing_usuario_atribuicoes (
        usuario_id,
        intencao,
        atribuicao_em
      )
      SELECT
        u.id,
        'profissional',
        u.created_at
      FROM usuarios u
      WHERE u.id = $1
      ON CONFLICT (usuario_id)
      DO UPDATE SET
        intencao = 'profissional',
        updated_at = NOW()
      RETURNING *
      `,
      [usuarioId]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  registrarConta,
  marcarIntencaoProfissional,
};
