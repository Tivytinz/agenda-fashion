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

function provedorCanonicoSql(expressao) {
  const canal =
    canalCanonicoSql(expressao);

  return `(
    CASE
      WHEN ${canal} = 'google'
        THEN 'google_ads'
      WHEN ${canal} = 'meta'
        THEN 'meta_ads'
      ELSE NULL
    END
  )`;
}

function identidadeComparavelSql(expressao) {
  return `(
    REGEXP_REPLACE(
      LOWER(
        COALESCE(
          NULLIF(BTRIM(${expressao}), ''),
          ''
        )
      ),
      '[^a-z0-9]+',
      '_',
      'g'
    )
  )`;
}

function criarVinculoCampanhaOficialSql({
  origem,
  midia,
  campanha,
  momento = null,
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

  const filtroObjetivoVinculado = objetivo
    ? `AND campanha_vinculada.objetivo = '${objetivo}'`
    : "";

  const filtroObjetivoVinculoExterno = objetivo
    ? `AND campanha_externa.objetivo = '${objetivo}'`
    : "";

  const canal =
    canalCanonicoSql(origem);
  const provedor =
    provedorCanonicoSql(origem);
  const canalResolvido =
    "contexto_atribuicao.canal_resolvido";
  const provedorResolvido =
    "contexto_atribuicao.provedor_resolvido";

  const dataAtribuicao = momento
    ? `((${momento}) AT TIME ZONE 'America/Sao_Paulo')::date`
    : null;

  const sincronizacaoCompleta = dataAtribuicao
    ? `(
      COALESCE((
        SELECT
          sincronizacao.status = 'sucesso'
          AND sincronizacao.campanhas_nao_vinculadas = 0
          AND sincronizacao.reconciliacao_campanhas_completa = TRUE
        FROM marketing_custo_sincronizacoes sincronizacao
        WHERE sincronizacao.provedor = ${provedorResolvido}
          AND ${dataAtribuicao}
            BETWEEN sincronizacao.data_inicio
              AND sincronizacao.data_fim
        ORDER BY
          sincronizacao.created_at DESC,
          sincronizacao.id DESC
        LIMIT 1
      ), FALSE)
    )`
    : "FALSE";

  const identidadeExata = `(
    LOWER(candidata.utm_campaign) = LOWER(${campanha})
    AND LOWER(candidata.utm_medium) = LOWER(${midia})
    AND (
      LOWER(candidata.utm_source) = LOWER(${origem})
      OR LOWER(candidata.canal) = ${canalResolvido}
    )
  )`;

  const identidadeVinculoExterno = (alias) => `(
    LOWER(${alias}.campanha_externa_id) =
      LOWER(${campanha})
    OR LOWER(${alias}.campanha_externa_nome) =
      LOWER(${campanha})
    OR ${identidadeComparavelSql(
      `${alias}.campanha_externa_nome`
    )} = ${identidadeComparavelSql(campanha)}
  )`;

  const vinculoExterno = `(
    EXISTS (
      SELECT 1
      FROM marketing_campanha_vinculos vinculo_externo
      WHERE vinculo_externo.campanha_id = candidata.id
        AND vinculo_externo.provedor = ${provedorResolvido}
        AND ${identidadeVinculoExterno(
          "vinculo_externo"
        )}
    )
    AND 1 = (
      SELECT COUNT(DISTINCT vinculo_identidade.campanha_id)
      FROM marketing_campanha_vinculos vinculo_identidade
      INNER JOIN marketing_campanhas campanha_externa
        ON campanha_externa.id = vinculo_identidade.campanha_id
      WHERE vinculo_identidade.provedor = ${provedorResolvido}
        AND ${identidadeVinculoExterno(
          "vinculo_identidade"
        )}
        ${filtroObjetivoVinculoExterno}
    )
  )`;

  const vinculoUnico = `(
    ${provedorResolvido} IS NOT NULL
    AND ${campanhaAusenteSql(campanha)}
    AND ${sincronizacaoCompleta}
    AND LOWER(candidata.canal) = ${canalResolvido}
    AND LOWER(candidata.utm_medium) = LOWER(${midia})
    AND EXISTS (
      SELECT 1
      FROM marketing_campanha_vinculos vinculo_candidato
      WHERE vinculo_candidato.campanha_id = candidata.id
        AND vinculo_candidato.provedor = ${provedorResolvido}
    )
    AND 1 = (
      SELECT COUNT(DISTINCT vinculo_unico.campanha_id)
      FROM marketing_campanha_vinculos vinculo_unico
      INNER JOIN marketing_campanhas campanha_vinculada
        ON campanha_vinculada.id = vinculo_unico.campanha_id
      WHERE vinculo_unico.provedor = ${provedorResolvido}
        AND LOWER(campanha_vinculada.canal) = ${canalResolvido}
        AND LOWER(campanha_vinculada.utm_medium) = LOWER(${midia})
        ${filtroObjetivoVinculado}
    )
  )`;

  return `
    LEFT JOIN LATERAL (
      SELECT
        resolvida.id,
        resolvida.objetivo,
        resolvida.ativo,
        resolvida.utm_source,
        resolvida.utm_medium,
        resolvida.utm_campaign,
        resolvida.metodo_resolucao
      FROM (
        SELECT
          candidata.id,
          candidata.objetivo,
          candidata.ativo,
          candidata.utm_source,
          candidata.utm_medium,
          candidata.utm_campaign,
          CASE
            WHEN ${identidadeExata}
              THEN 'utm_exata'
            WHEN ${vinculoExterno}
              THEN 'vinculo_plataforma'
            WHEN ${vinculoUnico}
              THEN 'vinculo_unico'
            ELSE NULL
          END AS metodo_resolucao
        FROM marketing_campanhas candidata
        CROSS JOIN LATERAL (
          SELECT
            ${canal} AS canal_resolvido,
            ${provedor} AS provedor_resolvido
        ) contexto_atribuicao
        WHERE 1 = 1
          ${filtroObjetivo}
      ) resolvida
      WHERE resolvida.metodo_resolucao IS NOT NULL
      ORDER BY
        CASE
          WHEN resolvida.metodo_resolucao =
            'utm_exata'
            THEN 0
          WHEN resolvida.metodo_resolucao =
            'vinculo_plataforma'
            THEN 1
          ELSE 2
        END,
        resolvida.id ASC
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
  provedorCanonicoSql,
  criarAtribuicaoSql,
  criarAtribuicaoUsuarioSql,
  criarVinculoCampanhaOficialSql,
};
