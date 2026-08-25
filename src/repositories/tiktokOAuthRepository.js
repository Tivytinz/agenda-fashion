const db = require("../db/db");

async function limparEstadosExpirados() {
  await db.query(
    `DELETE FROM marketing_tiktok_oauth_states
     WHERE expires_at <= NOW()
        OR consumed_at IS NOT NULL`
  );
}

async function salvarEstado({
  stateHash,
  usuarioId,
  redirectUri,
  expiresAt
}) {
  const { rows } = await db.query(
    `INSERT INTO marketing_tiktok_oauth_states (
       state_hash,
       usuario_id,
       redirect_uri,
       expires_at
     )
     VALUES ($1, $2, $3, $4)
     RETURNING state_hash, usuario_id, redirect_uri, expires_at`,
    [stateHash, usuarioId, redirectUri, expiresAt]
  );

  return rows[0] || null;
}

async function consumirEstado(stateHash) {
  return db.executarTransacao(async (client) => {
    const { rows } = await client.query(
      `SELECT state_hash, usuario_id, redirect_uri, expires_at, consumed_at
       FROM marketing_tiktok_oauth_states
       WHERE state_hash = $1
       FOR UPDATE`,
      [stateHash]
    );

    const state = rows[0] || null;
    if (
      !state ||
      state.consumed_at ||
      new Date(state.expires_at).getTime() <= Date.now()
    ) {
      return null;
    }

    await client.query(
      `UPDATE marketing_tiktok_oauth_states
       SET consumed_at = NOW()
       WHERE state_hash = $1`,
      [stateHash]
    );

    return state;
  });
}

async function buscarCredencial() {
  const { rows } = await db.query(
    `SELECT
       id,
       advertiser_id,
       access_token_encrypted,
       refresh_token_encrypted,
       access_token_expires_at,
       refresh_token_expires_at,
       scope,
       open_id,
       autorizado_por_usuario_id,
       created_at,
       updated_at
     FROM marketing_tiktok_oauth_credenciais
     WHERE id = 1
     LIMIT 1`
  );

  return rows[0] || null;
}

async function salvarCredencial({
  advertiserId,
  accessTokenEncrypted,
  refreshTokenEncrypted,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
  scope,
  openId,
  usuarioId
}) {
  const { rows } = await db.query(
    `INSERT INTO marketing_tiktok_oauth_credenciais (
       id,
       advertiser_id,
       access_token_encrypted,
       refresh_token_encrypted,
       access_token_expires_at,
       refresh_token_expires_at,
       scope,
       open_id,
       autorizado_por_usuario_id
     )
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id)
     DO UPDATE SET
       advertiser_id = EXCLUDED.advertiser_id,
       access_token_encrypted = EXCLUDED.access_token_encrypted,
       refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
       access_token_expires_at = EXCLUDED.access_token_expires_at,
       refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
       scope = EXCLUDED.scope,
       open_id = EXCLUDED.open_id,
       autorizado_por_usuario_id = EXCLUDED.autorizado_por_usuario_id,
       updated_at = NOW()
     RETURNING
       id,
       advertiser_id,
       access_token_expires_at,
       refresh_token_expires_at,
       scope,
       open_id,
       autorizado_por_usuario_id,
       created_at,
       updated_at`,
    [
      advertiserId,
      accessTokenEncrypted,
      refreshTokenEncrypted,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      scope || null,
      openId || null,
      usuarioId || null
    ]
  );

  return rows[0] || null;
}

module.exports = {
  limparEstadosExpirados,
  salvarEstado,
  consumirEstado,
  buscarCredencial,
  salvarCredencial
};
