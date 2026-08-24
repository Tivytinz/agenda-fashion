const MIDIAS_PAGAS = Object.freeze([
  "cpc",
  "ppc",
  "paid",
  "paid_search",
  "paid_social",
  "paid-social",
  "social_paid",
  "display",
]);

const MIDIAS_ORGANICAS = Object.freeze([
  "organic",
  "organico",
  "orgânico",
  "seo",
  "social",
  "organic_social",
  "referral",
  "email",
  "whatsapp",
  "messaging",
]);

const CAMPANHAS_AUSENTES = Object.freeze([
  "",
  "(sem campanha)",
  "sem campanha",
  "organico",
  "orgânico",
]);

function listaSql(valores) {
  return valores
    .map((valor) => `'${valor.replaceAll("'", "''")}'`)
    .join(", ");
}

function propriedadeSql(alias, chave) {
  return `NULLIF(BTRIM(${alias}.propriedades ->> '${chave}'), '')`;
}

function colunaSql(alias, chave) {
  return `NULLIF(BTRIM(${alias}.${chave}), '')`;
}

function campanhaAusenteSql(expressao) {
  return `(
    LOWER(COALESCE(NULLIF(BTRIM(${expressao}), ''), ''))
      IN (${listaSql(CAMPANHAS_AUSENTES)})
  )`;
}

function canalCanonicoSql(expressao) {
  return `(
    CASE
      WHEN LOWER(COALESCE(${expressao}, '')) IN (
        'meta', 'facebook', 'instagram'
      ) THEN 'meta'
      WHEN LOWER(COALESCE(${expressao}, '')) IN (
        'google', 'google_ads', 'google-ads'
      ) THEN 'google'
      WHEN LOWER(COALESCE(${expressao}, '')) = 'pinterest'
        THEN 'pinterest'
      WHEN LOWER(COALESCE(${expressao}, '')) = 'tiktok'
        THEN 'tiktok'
      ELSE LOWER(COALESCE(${expressao}, ''))
    END
  )`;
}

function criarVinculoCampanhaOficialSql({
  origem,
  midia,
  campanha,
  alias = "campanha_oficial",
  objetivo = null,
}) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) {
    throw new Error("Alias SQL de campanha inválido.");
  }

  if (
    objetivo !== null &&
    !["cliente", "profissional"].includes(objetivo)
  ) {
    throw new Error("Objetivo de campanha inválido.");
  }

  const filtroObjetivo = objetivo
    ? `AND candidata.objetivo = '${objetivo}'`
    : "";

  return `
    LEFT JOIN LATERAL (
      SELECT
        candidata.id,
        candidata.objetivo,
        candidata.ativo,
        candidata.utm_source,
        candidata.utm_medium,
        candidata.utm_campaign
      FROM marketing_campanhas candidata
      WHERE LOWER(candidata.utm_campaign) = LOWER(${campanha})
        AND LOWER(candidata.utm_medium) = LOWER(${midia})
        AND (
          LOWER(candidata.utm_source) = LOWER(${origem})
          OR LOWER(candidata.canal) = ${canalCanonicoSql(origem)}
        )
        ${filtroObjetivo}
      ORDER BY
        CASE
          WHEN LOWER(candidata.utm_source) = LOWER(${origem})
            THEN 0
          ELSE 1
        END,
        candidata.id ASC
      LIMIT 1
    ) ${alias} ON TRUE
  `;
}

function criarAtribuicaoSql(alias = "e") {
  const gclid = propriedadeSql(alias, "gclid");
  const gbraid = propriedadeSql(alias, "gbraid");
  const wbraid = propriedadeSql(alias, "wbraid");
  const fbclid = propriedadeSql(alias, "fbclid");
  const msclkid = propriedadeSql(alias, "msclkid");
  const ttclid = propriedadeSql(alias, "ttclid");
  const epik = propriedadeSql(alias, "epik");
  const utmSource = propriedadeSql(alias, "utm_source");
  const utmMedium = propriedadeSql(alias, "utm_medium");
  const utmCampaign = propriedadeSql(alias, "utm_campaign");
  const referrerHost = propriedadeSql(alias, "referrer_host");

  const googleClick = `(
    ${gclid} IS NOT NULL
    OR ${gbraid} IS NOT NULL
    OR ${wbraid} IS NOT NULL
  )`;
  const microsoftClick = `(${msclkid} IS NOT NULL)`;
  const tiktokClick = `(${ttclid} IS NOT NULL)`;
  const pinterestClick = `(${epik} IS NOT NULL)`;
  const paidClick = `(
    ${googleClick}
    OR ${microsoftClick}
    OR ${tiktokClick}
    OR ${pinterestClick}
  )`;
  const midiaPaga = `(
    LOWER(COALESCE(${utmMedium}, '')) IN (${listaSql(MIDIAS_PAGAS)})
  )`;
  const midiaOrganica = `(
    LOWER(COALESCE(${utmMedium}, '')) IN (${listaSql(MIDIAS_ORGANICAS)})
  )`;
  const utmPresente = `(
    ${utmSource} IS NOT NULL
    OR ${utmMedium} IS NOT NULL
    OR ${utmCampaign} IS NOT NULL
  )`;
  const atribuicaoPaga = `(
    ${paidClick}
    OR ${midiaPaga}
  )`;
  const trafegoOrganico = `(
    NOT ${atribuicaoPaga}
    AND (
      ${midiaOrganica}
      OR (
        NOT ${utmPresente}
        AND (
          ${referrerHost} IS NOT NULL
          OR ${fbclid} IS NOT NULL
        )
      )
    )
  )`;
  const atribuicaoRastreada = `(
    ${utmPresente}
    OR ${paidClick}
    OR ${fbclid} IS NOT NULL
  )`;
  const origem = `(
    CASE
      WHEN ${googleClick} THEN 'google'
      WHEN ${microsoftClick} THEN 'microsoft'
      WHEN ${tiktokClick} THEN 'tiktok'
      WHEN ${pinterestClick} THEN 'pinterest'
      ELSE COALESCE(${utmSource}, 'desconhecida')
    END
  )`;
  const midia = `(
    CASE
      WHEN ${paidClick} THEN 'cpc'
      ELSE COALESCE(${utmMedium}, 'desconhecida')
    END
  )`;
  const campanha = `COALESCE(${utmCampaign}, '(sem campanha)')`;

  return {
    gclid,
    gbraid,
    wbraid,
    fbclid,
    msclkid,
    ttclid,
    epik,
    utmSource,
    utmMedium,
    utmCampaign,
    referrerHost,
    googleClick,
    microsoftClick,
    tiktokClick,
    pinterestClick,
    paidClick,
    midiaPaga,
    midiaOrganica,
    utmPresente,
    atribuicaoPaga,
    trafegoOrganico,
    atribuicaoRastreada,
    origem,
    midia,
    campanha,
  };
}

function criarAtribuicaoUsuarioSql(alias = "mua") {
  const gclid = colunaSql(alias, "gclid");
  const gbraid = colunaSql(alias, "gbraid");
  const wbraid = colunaSql(alias, "wbraid");
  const fbclid = colunaSql(alias, "fbclid");
  const msclkid = colunaSql(alias, "msclkid");
  const ttclid = colunaSql(alias, "ttclid");
  const epik = colunaSql(alias, "epik");
  const utmSource = colunaSql(alias, "utm_source");
  const utmMedium = colunaSql(alias, "utm_medium");
  const utmCampaign = colunaSql(alias, "utm_campaign");

  const googleClick = `(
    ${gclid} IS NOT NULL
    OR ${gbraid} IS NOT NULL
    OR ${wbraid} IS NOT NULL
  )`;
  const microsoftClick = `(${msclkid} IS NOT NULL)`;
  const tiktokClick = `(${ttclid} IS NOT NULL)`;
  const pinterestClick = `(${epik} IS NOT NULL)`;
  const paidClick = `(
    ${googleClick}
    OR ${microsoftClick}
    OR ${tiktokClick}
    OR ${pinterestClick}
  )`;
  const midiaPaga = `(
    LOWER(COALESCE(${utmMedium}, '')) IN (${listaSql(MIDIAS_PAGAS)})
  )`;
  const midiaOrganica = `(
    LOWER(COALESCE(${utmMedium}, '')) IN (${listaSql(MIDIAS_ORGANICAS)})
  )`;
  const utmPresente = `(
    ${utmSource} IS NOT NULL
    OR ${utmMedium} IS NOT NULL
    OR ${utmCampaign} IS NOT NULL
  )`;
  const atribuicaoPaga = `(
    ${paidClick}
    OR ${midiaPaga}
  )`;
  const atribuicaoRastreada = `(
    ${utmPresente}
    OR ${paidClick}
    OR ${fbclid} IS NOT NULL
  )`;
  const trafegoOrganico = `(
    NOT ${atribuicaoPaga}
    AND (
      ${midiaOrganica}
      OR NOT ${atribuicaoRastreada}
      OR (
        NOT ${utmPresente}
        AND ${fbclid} IS NOT NULL
      )
    )
  )`;
  const origem = `(
    CASE
      WHEN ${googleClick} THEN 'google'
      WHEN ${microsoftClick} THEN 'microsoft'
      WHEN ${tiktokClick} THEN 'tiktok'
      WHEN ${pinterestClick} THEN 'pinterest'
      WHEN ${utmSource} IS NOT NULL THEN ${utmSource}
      WHEN ${trafegoOrganico} THEN 'organico'
      ELSE 'desconhecida'
    END
  )`;
  const midia = `(
    CASE
      WHEN ${paidClick} THEN 'cpc'
      WHEN ${utmMedium} IS NOT NULL THEN ${utmMedium}
      WHEN ${trafegoOrganico} THEN 'none'
      ELSE 'desconhecida'
    END
  )`;
  const campanha = `(
    CASE
      WHEN ${utmCampaign} IS NOT NULL THEN ${utmCampaign}
      WHEN ${atribuicaoPaga} THEN '(sem campanha)'
      WHEN ${trafegoOrganico} THEN 'organico'
      ELSE '(sem campanha)'
    END
  )`;

  return {
    gclid,
    gbraid,
    wbraid,
    fbclid,
    msclkid,
    ttclid,
    epik,
    utmSource,
    utmMedium,
    utmCampaign,
    googleClick,
    microsoftClick,
    tiktokClick,
    pinterestClick,
    paidClick,
    midiaPaga,
    midiaOrganica,
    utmPresente,
    atribuicaoPaga,
    atribuicaoRastreada,
    trafegoOrganico,
    origem,
    midia,
    campanha,
  };
}

module.exports = {
  MIDIAS_PAGAS,
  MIDIAS_ORGANICAS,
  CAMPANHAS_AUSENTES,
  campanhaAusenteSql,
  canalCanonicoSql,
  criarAtribuicaoSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
};
