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
  fbclid,
  landingPage,
  lastUtmSource,
  lastUtmMedium,
  lastUtmCampaign,
  lastUtmContent,
  lastUtmTerm,
  lastGclid,
  lastFbclid,
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
        fbclid,
        landing_page,
        last_utm_source,
        last_utm_medium,
        last_utm_campaign,
        last_utm_content,
        last_utm_term,
        last_gclid,
        last_fbclid,
        last_landing_page,
        atribuicao_em
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, NOW()
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
        fbclid,
        landingPage,
        lastUtmSource || utmSource,
        lastUtmMedium || utmMedium,
        lastUtmCampaign || utmCampaign,
        lastUtmContent || utmContent,
        lastUtmTerm || utmTerm,
        lastGclid || gclid,
        lastFbclid || fbclid,
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
