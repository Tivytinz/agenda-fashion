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
      DO NOTHING
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
