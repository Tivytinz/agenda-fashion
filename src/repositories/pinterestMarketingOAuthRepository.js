const db = require("../db/db");

async function criarEstado({
  stateHash,
  usuarioId,
  expiresAt
}) {
  await db.query(`
    DELETE FROM marketing_pinterest_oauth_states
    WHERE expires_at <= NOW()
       OR consumed_at IS NOT NULL
  `);

  const resultado = await db.query(`
    INSERT INTO marketing_pinterest_oauth_states (
      state_hash,
      usuario_id,
      expires_at
    ) VALUES ($1, $2, $3)
    RETURNING id, usuario_id, expires_at, created_at
  `, [stateHash, usuarioId, expiresAt]);

  return resultado.rows[0];
}

async function consumirEstado({ stateHash }) {
  return db.executarTransacao(async (client) => {
    const resultado = await client.query(`
      SELECT
        id,
        state_hash,
        usuario_id,
        expires_at,
        consumed_at,
        created_at
      FROM marketing_pinterest_oauth_states
      WHERE state_hash = $1
      LIMIT 1
      FOR UPDATE
    `, [stateHash]);

    const estado = resultado.rows[0] || null;
    if (!estado) return null;

    const expirado =
      !estado.expires_at ||
      new Date(estado.expires_at).getTime() <= Date.now();

    if (estado.consumed_at || expirado) {
      return null;
    }

    await client.query(`
      UPDATE marketing_pinterest_oauth_states
      SET consumed_at = NOW()
      WHERE id = $1
    `, [estado.id]);

    return estado;
  });
}

async function buscarCredencial() {
  const resultado = await db.query(`
    SELECT
      id,
      ad_account_id,
      access_token_ciphertext,
      refresh_token_ciphertext,
      scope,
      access_token_expires_at,
      refresh_token_expires_at,
      autorizado_por_usuario_id,
      created_at,
      updated_at
    FROM marketing_pinterest_oauth_credenciais
    WHERE id = 1
    LIMIT 1
  `);

  return resultado.rows[0] || null;
}

async function salvarCredencial({
  adAccountId,
  accessTokenCiphertext,
  refreshTokenCiphertext,
  scope,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
  usuarioId
}) {
  const resultado = await db.query(`
    INSERT INTO marketing_pinterest_oauth_credenciais (
      id,
      ad_account_id,
      access_token_ciphertext,
      refresh_token_ciphertext,
      scope,
      access_token_expires_at,
      refresh_token_expires_at,
      autorizado_por_usuario_id
    ) VALUES (
      1,
      $1,
      $2,
      $3,
      $4::jsonb,
      $5,
      $6,
      $7
    )
    ON CONFLICT (id)
    DO UPDATE SET
      ad_account_id = EXCLUDED.ad_account_id,
      access_token_ciphertext = EXCLUDED.access_token_ciphertext,
      refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
      scope = EXCLUDED.scope,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
      autorizado_por_usuario_id = EXCLUDED.autorizado_por_usuario_id,
      updated_at = NOW()
    RETURNING
      id,
      ad_account_id,
      scope,
      access_token_expires_at,
      refresh_token_expires_at,
      autorizado_por_usuario_id,
      created_at,
      updated_at
  `, [
    adAccountId,
    accessTokenCiphertext,
    refreshTokenCiphertext,
    JSON.stringify(Array.isArray(scope) ? scope : []),
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
    usuarioId
  ]);

  return resultado.rows[0];
}

async function atualizarTokens({
  accessTokenCiphertext,
  refreshTokenCiphertext,
  scope,
  accessTokenExpiresAt,
  refreshTokenExpiresAt
}) {
  const resultado = await db.query(`
    UPDATE marketing_pinterest_oauth_credenciais
    SET
      access_token_ciphertext = $1,
      refresh_token_ciphertext = $2,
      scope = $3::jsonb,
      access_token_expires_at = $4,
      refresh_token_expires_at = $5,
      updated_at = NOW()
    WHERE id = 1
    RETURNING
      id,
      ad_account_id,
      scope,
      access_token_expires_at,
      refresh_token_expires_at,
      created_at,
      updated_at
  `, [
    accessTokenCiphertext,
    refreshTokenCiphertext,
    JSON.stringify(Array.isArray(scope) ? scope : []),
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  ]);

  return resultado.rows[0] || null;
}

module.exports = {
  criarEstado,
  consumirEstado,
  buscarCredencial,
  salvarCredencial,
  atualizarTokens
};
