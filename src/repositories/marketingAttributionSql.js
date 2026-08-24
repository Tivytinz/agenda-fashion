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

function listaSql(valores) {
  return valores
    .map((valor) => `'${valor.replaceAll("'", "''")}'`)
    .join(", ");
}

function propriedadeSql(alias, chave) {
  return `NULLIF(BTRIM(${alias}.propriedades ->> '${chave}'), '')`;
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

module.exports = {
  MIDIAS_PAGAS,
  MIDIAS_ORGANICAS,
  criarAtribuicaoSql,
};
