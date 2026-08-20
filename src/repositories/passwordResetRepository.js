const db = require("../db/db");

async function substituirToken({
  usuarioId,
  tokenHash,
  expiraEm,
}) {
  return db.executarTransacao(async (client) => {
    await client.query(
      `
      SELECT id
      FROM usuarios
      WHERE id = $1
      FOR UPDATE
      `,
      [usuarioId]
    );

    await client.query(
      `
      UPDATE redefinicoes_senha
      SET usado_em = COALESCE(usado_em, NOW())
      WHERE usuario_id = $1
        AND usado_em IS NULL
      `,
      [usuarioId]
    );

    const resultado = await client.query(
      `
      INSERT INTO redefinicoes_senha (
        usuario_id,
        token_hash,
        expira_em
      )
      VALUES ($1, $2, $3)
      RETURNING id, expira_em
      `,
      [usuarioId, tokenHash, expiraEm]
    );

    return resultado.rows[0];
  });
}

async function invalidarToken(tokenHash) {
  await db.query(
    `
    UPDATE redefinicoes_senha
    SET usado_em = COALESCE(usado_em, NOW())
    WHERE token_hash = $1
    `,
    [tokenHash]
  );
}

async function redefinirSenha({
  tokenHash,
  senhaHash,
}) {
  return db.executarTransacao(async (client) => {
    const token = await client.query(
      `
      SELECT
        rs.id,
        rs.usuario_id
      FROM redefinicoes_senha rs
      INNER JOIN usuarios u
        ON u.id = rs.usuario_id
      WHERE rs.token_hash = $1
        AND rs.usado_em IS NULL
        AND rs.expira_em > NOW()
        AND u.ativo = TRUE
      LIMIT 1
      FOR UPDATE OF rs, u
      `,
      [tokenHash]
    );

    const registro = token.rows[0];

    if (!registro) {
      return null;
    }

    await client.query(
      `
      UPDATE usuarios
      SET
        senha = $2,
        senha_alterada_em = NOW()
      WHERE id = $1
      `,
      [registro.usuario_id, senhaHash]
    );

    await client.query(
      `
      UPDATE redefinicoes_senha
      SET usado_em = NOW()
      WHERE usuario_id = $1
        AND usado_em IS NULL
      `,
      [registro.usuario_id]
    );

    return {
      usuarioId: registro.usuario_id,
    };
  });
}

module.exports = {
  substituirToken,
  invalidarToken,
  redefinirSenha,
};
