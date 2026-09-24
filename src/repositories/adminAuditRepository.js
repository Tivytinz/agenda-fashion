const db = require("../db/db");

async function registrarEvento(evento, executor = db) {
  const resultado = await executor.query(`
    INSERT INTO admin_auditoria_eventos (
      tentativa_id, fase, ator_usuario_id, papel_admin, acao,
      alvo_tipo, alvo_id, alvo_codigo, request_id, resultado, http_status,
      alvo_tentativa_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, ocorrido_em
  `, [
    evento.tentativaId, evento.fase, evento.atorUsuarioId,
    evento.papelAdmin, evento.acao, evento.alvoTipo,
    evento.alvoId || null, evento.alvoCodigo || null, evento.requestId || null,
    evento.resultado || null, evento.httpStatus || null,
    evento.alvoTentativaId || null
  ]);
  return resultado.rows[0];
}

async function listar({ atorId, acao, alvoTipo, alvoId, resultado, limite, offset }, executor = db) {
  const filtros = [atorId || null, acao || null, alvoTipo || null, alvoId || null, resultado || null];
  const where = `
    WHERE i.fase = 'INICIADA'
      AND ($1::BIGINT IS NULL OR i.ator_usuario_id = $1)
      AND ($2::TEXT IS NULL OR i.acao = $2)
      AND ($3::TEXT IS NULL OR i.alvo_tipo = $3)
      AND ($4::BIGINT IS NULL OR i.alvo_id = $4 OR r.alvo_id = $4)
      AND ($5::TEXT IS NULL
        OR ($5 = 'PENDENTE' AND r.id IS NULL AND v.id IS NULL)
        OR ($5 = 'REVISADA' AND r.id IS NULL AND v.id IS NOT NULL)
        OR r.resultado = $5)
  `;
  const join = `LEFT JOIN admin_auditoria_eventos r
    ON r.tentativa_id = i.tentativa_id AND r.fase = 'RESULTADO'
    LEFT JOIN admin_auditoria_revisoes v ON v.tentativa_id = i.tentativa_id`;
  const [count, records] = await Promise.all([
    executor.query(`SELECT COUNT(*)::INT AS total FROM admin_auditoria_eventos i ${join} ${where}`, filtros),
    executor.query(`
      SELECT i.tentativa_id, i.ator_usuario_id, i.papel_admin,
        i.acao, i.alvo_tipo, COALESCE(r.alvo_id, i.alvo_id) AS alvo_id,
        i.alvo_codigo, i.alvo_tentativa_id,
        i.request_id, i.ocorrido_em AS iniciado_em,
        r.ocorrido_em AS finalizado_em, r.resultado, r.http_status,
        i.ocorrido_em <= NOW() - INTERVAL '10 minutes' AS vencida,
        v.id AS revisao_id, v.revisor_usuario_id, v.avaliacao,
        v.evidencia_tipo, v.evidencia_referencia_sha256, v.revisado_em
      FROM admin_auditoria_eventos i
      ${join}
      ${where}
      ORDER BY i.ocorrido_em DESC, i.id DESC
      LIMIT $6 OFFSET $7
    `, [...filtros, limite, offset])
  ]);
  return { total: Number(count.rows[0]?.total || 0), rows: records.rows };
}

async function buscarTentativaParaRevisao(tentativaId, client) {
  const { rows } = await client.query(`
    SELECT i.id,
      i.ocorrido_em <= NOW() - INTERVAL '10 minutes' AS vencida,
      r.id AS resultado_id, v.id AS revisao_id
    FROM admin_auditoria_eventos i
    LEFT JOIN admin_auditoria_eventos r
      ON r.tentativa_id = i.tentativa_id AND r.fase = 'RESULTADO'
    LEFT JOIN admin_auditoria_revisoes v
      ON v.tentativa_id = i.tentativa_id
    WHERE i.tentativa_id = $1 AND i.fase = 'INICIADA'
    FOR UPDATE OF i
  `, [tentativaId]);
  return rows[0] || null;
}

async function registrarRevisao(review, client) {
  const { rows } = await client.query(`
    INSERT INTO admin_auditoria_revisoes (
      tentativa_id, revisor_usuario_id,
      avaliacao, evidencia_tipo, evidencia_referencia_sha256
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING revisado_em
  `, [
    review.tentativaId, review.revisorUsuarioId,
    review.avaliacao, review.evidenciaTipo, review.evidenciaReferenciaHash
  ]);
  return rows[0];
}

module.exports = {
  registrarEvento, listar, transacao: db.executarTransacao,
  buscarTentativaParaRevisao, registrarRevisao
};
