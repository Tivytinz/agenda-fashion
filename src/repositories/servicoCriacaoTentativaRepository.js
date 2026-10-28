async function buscar({ negocioId, usuarioId, chaveIdempotencia }, executor) {
  const result = await executor.query(`
    SELECT * FROM servico_criacao_tentativas
    WHERE negocio_id = $1 AND usuario_id = $2 AND chave_idempotencia = $3
  `, [negocioId, usuarioId, chaveIdempotencia]);
  return result.rows[0] || null;
}

async function iniciar({ negocioId, usuarioId, chaveIdempotencia, requestHash }, executor) {
  const parameters = [negocioId, usuarioId, chaveIdempotencia, requestHash];
  const inserted = await executor.query(`
    INSERT INTO servico_criacao_tentativas
      (negocio_id, usuario_id, chave_idempotencia, request_hash)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (negocio_id, usuario_id, chave_idempotencia) DO NOTHING
    RETURNING *
  `, parameters);
  if (inserted.rows[0]) return inserted.rows[0];

  const existing = await executor.query(`
    SELECT * FROM servico_criacao_tentativas
    WHERE negocio_id = $1 AND usuario_id = $2 AND chave_idempotencia = $3
    FOR UPDATE
  `, parameters.slice(0, 3));
  return existing.rows[0];
}

async function concluir(id, servicoId, executor) {
  await executor.query(`
    UPDATE servico_criacao_tentativas
    SET servico_id = $2, concluida_em = NOW()
    WHERE id = $1 AND concluida_em IS NULL
  `, [id, servicoId]);
}

async function buscarPublicacao(negocioId, executor) {
  const result = await executor.query(`
    SELECT id, publicado, primeira_publicacao_em, despublicado_manual_em
    FROM negocios WHERE id = $1
  `, [negocioId]);
  return result.rows[0] || null;
}

module.exports = { buscar, iniciar, concluir, buscarPublicacao };
