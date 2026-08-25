const db = require("../db/db");
const marketingConversaoRepository = require(
  "./marketingConversaoRepository"
);

async function salvarConsentimentoUsuario({
  usuarioId,
  consentido,
  clientId,
  origem,
  textoVersao
}) {
  return db.executarTransacao(
    async (client) => {
      const resultado = await client.query(
        `
        INSERT INTO marketing_usuario_atribuicoes (
          usuario_id,
          intencao,
          atribuicao_em,
          google_consentimento_status,
          google_consentimento_atualizado_em,
          google_consentido_em,
          google_revogado_em,
          google_client_id
        )
        SELECT
          u.id,
          'indefinida',
          u.created_at,
          $2::boolean,
          NOW(),
          CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
          CASE WHEN $2::boolean THEN NULL ELSE NOW() END,
          CASE WHEN $2::boolean THEN $3 ELSE NULL END
        FROM usuarios u
        WHERE u.id = $1
        ON CONFLICT (usuario_id)
        DO UPDATE SET
          google_consentimento_status = $2::boolean,
          google_consentimento_atualizado_em = NOW(),
          google_consentido_em = CASE
            WHEN $2::boolean THEN NOW()
            ELSE NULL
          END,
          google_revogado_em = CASE
            WHEN $2::boolean THEN NULL
            ELSE NOW()
          END,
          google_client_id = CASE
            WHEN $2::boolean THEN $3
            ELSE NULL
          END,
          utm_source = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.utm_source ELSE NULL END,
          utm_medium = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.utm_medium ELSE NULL END,
          utm_campaign = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.utm_campaign ELSE NULL END,
          utm_content = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.utm_content ELSE NULL END,
          utm_term = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.utm_term ELSE NULL END,
          gclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.gclid ELSE NULL END,
          gbraid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.gbraid ELSE NULL END,
          wbraid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.wbraid ELSE NULL END,
          fbclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.fbclid ELSE NULL END,
          msclkid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.msclkid ELSE NULL END,
          ttclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.ttclid ELSE NULL END,
          epik = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.epik ELSE NULL END,
          af_source = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.af_source ELSE NULL END,
          af_medium = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.af_medium ELSE NULL END,
          af_content = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.af_content ELSE NULL END,
          landing_page = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.landing_page ELSE NULL END,
          last_utm_source = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_utm_source ELSE NULL END,
          last_utm_medium = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_utm_medium ELSE NULL END,
          last_utm_campaign = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_utm_campaign ELSE NULL END,
          last_utm_content = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_utm_content ELSE NULL END,
          last_utm_term = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_utm_term ELSE NULL END,
          last_gclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_gclid ELSE NULL END,
          last_gbraid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_gbraid ELSE NULL END,
          last_wbraid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_wbraid ELSE NULL END,
          last_fbclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_fbclid ELSE NULL END,
          last_msclkid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_msclkid ELSE NULL END,
          last_ttclid = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_ttclid ELSE NULL END,
          last_epik = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_epik ELSE NULL END,
          last_af_source = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_af_source ELSE NULL END,
          last_af_medium = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_af_medium ELSE NULL END,
          last_af_content = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_af_content ELSE NULL END,
          last_landing_page = CASE WHEN $2::boolean THEN marketing_usuario_atribuicoes.last_landing_page ELSE NULL END,
          updated_at = NOW()
        RETURNING *
        `,
        [
          usuarioId,
          Boolean(consentido),
          clientId || null
        ]
      );

      const atribuicao =
        resultado.rows[0] || null;

      if (!atribuicao) {
        return null;
      }

      await client.query(
        `
        INSERT INTO marketing_google_consentimentos (
          usuario_id,
          consentido,
          origem,
          texto_versao
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          usuarioId,
          Boolean(consentido),
          origem,
          textoVersao
        ]
      );

      return atribuicao;
    }
  );
}

async function buscarPerfilPorNegocio(negocioId) {
  const resultado = await db.query(
    `
    SELECT
      u.id AS usuario_id,
      mua.gclid,
      mua.google_consentimento_status,
      mua.google_consentimento_atualizado_em,
      mua.google_consentido_em,
      mua.google_revogado_em,
      mua.google_client_id
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    LEFT JOIN marketing_usuario_atribuicoes mua
      ON mua.usuario_id = u.id
    WHERE un.negocio_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    ORDER BY
      un.ativo DESC,
      un.created_at ASC,
      un.id ASC
    LIMIT 1
    `,
    [negocioId]
  );

  return resultado.rows[0] || null;
}

module.exports = {
  salvarConsentimentoUsuario,
  buscarPerfilPorNegocio,
  ehPrimeiroPagamentoAssinatura:
    marketingConversaoRepository
      .ehPrimeiroPagamentoAssinatura
};
