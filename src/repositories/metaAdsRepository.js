const db = require("../db/db");
const marketingConversaoRepository = require(
  "./marketingConversaoRepository"
);

async function salvarConsentimentoUsuario({
  usuarioId,
  consentido,
  fbp,
  fbc
}) {
  const resultado = await db.query(
    `
    INSERT INTO marketing_usuario_atribuicoes (
      usuario_id,
      intencao,
      atribuicao_em,
      meta_consentido_em,
      meta_fbp,
      meta_fbc
    )
    SELECT
      u.id,
      'indefinida',
      u.created_at,
      CASE WHEN $2::boolean THEN NOW() ELSE NULL END,
      CASE WHEN $2::boolean THEN $3 ELSE NULL END,
      CASE WHEN $2::boolean THEN $4 ELSE NULL END
    FROM usuarios u
    WHERE u.id = $1
    ON CONFLICT (usuario_id)
    DO UPDATE SET
      meta_consentido_em = CASE
        WHEN $2::boolean
          THEN COALESCE(
            marketing_usuario_atribuicoes.meta_consentido_em,
            NOW()
          )
        ELSE NULL
      END,
      meta_fbp = CASE
        WHEN $2::boolean
          THEN COALESCE(
            $3,
            marketing_usuario_atribuicoes.meta_fbp
          )
        ELSE NULL
      END,
      meta_fbc = CASE
        WHEN $2::boolean
          THEN COALESCE(
            $4,
            marketing_usuario_atribuicoes.meta_fbc
          )
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING *
    `,
    [
      usuarioId,
      Boolean(consentido),
      fbp || null,
      fbc || null
    ]
  );

  return resultado.rows[0] || null;
}

async function buscarPerfilPorUsuario(usuarioId) {
  const resultado = await db.query(
    `
    SELECT
      u.id AS usuario_id,
      u.email,
      u.whatsapp,
      mua.intencao,
      mua.fbclid,
      mua.meta_consentido_em,
      mua.meta_fbp,
      mua.meta_fbc
    FROM usuarios u
    LEFT JOIN marketing_usuario_atribuicoes mua
      ON mua.usuario_id = u.id
    WHERE u.id = $1
    LIMIT 1
    `,
    [usuarioId]
  );

  return resultado.rows[0] || null;
}

async function buscarPerfilPorNegocio(negocioId) {
  const resultado = await db.query(
    `
    SELECT
      u.id AS usuario_id,
      u.email,
      u.whatsapp,
      mua.intencao,
      mua.fbclid,
      mua.meta_consentido_em,
      mua.meta_fbp,
      mua.meta_fbc
    FROM usuarios_negocios un
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    LEFT JOIN marketing_usuario_atribuicoes mua
      ON mua.usuario_id = u.id
    WHERE un.negocio_id = $1
      AND un.papel = 'dono'
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
  buscarPerfilPorUsuario,
  buscarPerfilPorNegocio,
  ehPrimeiroPagamentoAssinatura:
    marketingConversaoRepository
      .ehPrimeiroPagamentoAssinatura
};
