const db = require("../db/db");

const CAMPANHAS_LEGADAS = Object.freeze([
  "aquisicao_profissionais",
  "search_aquisicao_profissionais",
  "profissionais_google_ads",
]);

async function garantirCampanhaGoogleProfissionais({
  client = db,
  campanhaOficial,
}) {
  const oficial = await client.query(
    `
    INSERT INTO marketing_campanhas (
      nome,
      canal,
      objetivo,
      utm_source,
      utm_medium,
      utm_campaign,
      destino_path,
      ativo
    )
    VALUES (
      'Google Ads · Aquisição de profissionais',
      'google',
      'profissional',
      'google',
      'cpc',
      $1,
      '/para-profissionais',
      TRUE
    )
    ON CONFLICT (
      utm_source,
      utm_medium,
      utm_campaign
    )
    DO UPDATE SET
      nome = EXCLUDED.nome,
      canal = EXCLUDED.canal,
      objetivo = EXCLUDED.objetivo,
      destino_path = EXCLUDED.destino_path,
      ativo = TRUE,
      updated_at = NOW()
    RETURNING id
    `,
    [campanhaOficial]
  );

  await client.query(
    `
    INSERT INTO marketing_campanhas (
      nome,
      canal,
      objetivo,
      utm_source,
      utm_medium,
      utm_campaign,
      destino_path,
      ativo
    )
    SELECT
      'Google Ads · Alias histórico · ' || alias,
      'google',
      'profissional',
      'google',
      'cpc',
      alias,
      '/para-profissionais',
      FALSE
    FROM UNNEST($1::TEXT[])
      AS aliases(alias)
    ON CONFLICT (
      utm_source,
      utm_medium,
      utm_campaign
    )
    DO UPDATE SET
      canal = EXCLUDED.canal,
      objetivo = EXCLUDED.objetivo,
      destino_path = EXCLUDED.destino_path,
      updated_at = NOW()
    `,
    [CAMPANHAS_LEGADAS]
  );

  return oficial;
}

module.exports = {
  CAMPANHAS_LEGADAS,
  garantirCampanhaGoogleProfissionais,
};
