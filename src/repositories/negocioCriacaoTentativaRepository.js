async function buscar(usuarioId, chave, client) {
  const result = await client.query(`
    SELECT negocio_id, request_hash FROM negocio_criacao_tentativas
    WHERE usuario_id = $1 AND chave_idempotencia = $2
  `, [usuarioId, chave]);
  return result.rows[0] || null;
}

async function concluir({ usuarioId, chaveIdempotencia, requestHash, negocioId }, client) {
  await client.query(`
    INSERT INTO negocio_criacao_tentativas (usuario_id, chave_idempotencia, request_hash, negocio_id)
    VALUES ($1, $2, $3, $4)
  `, [usuarioId, chaveIdempotencia, requestHash, negocioId]);
}

module.exports = { buscar, concluir };
