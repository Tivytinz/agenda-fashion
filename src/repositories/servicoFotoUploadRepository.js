async function buscar({ negocioId, usuarioId, servicoId, chave }, client) {
  const result = await client.query(`
    SELECT arquivo_hash, foto_id FROM servico_foto_upload_tentativas
    WHERE negocio_id = $1 AND usuario_id = $2 AND servico_id = $3 AND chave_idempotencia = $4
  `, [negocioId, usuarioId, servicoId, chave]);
  return result.rows[0] || null;
}

async function concluir({ negocioId, usuarioId, servicoId, chave, arquivoHash, fotoId }, client) {
  await client.query(`
    INSERT INTO servico_foto_upload_tentativas
      (negocio_id, usuario_id, servico_id, chave_idempotencia, arquivo_hash, foto_id)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [negocioId, usuarioId, servicoId, chave, arquivoHash, fotoId]);
}

module.exports = { buscar, concluir };
