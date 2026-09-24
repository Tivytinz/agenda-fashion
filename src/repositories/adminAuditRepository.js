const db = require("../db/db");

async function registrarEvento(evento, executor = db) {
  const resultado = await executor.query(`
    INSERT INTO admin_auditoria_eventos (
      tentativa_id, fase, ator_usuario_id, papel_admin, acao,
      alvo_tipo, alvo_id, alvo_codigo, request_id, resultado, http_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, ocorrido_em
  `, [
    evento.tentativaId, evento.fase, evento.atorUsuarioId,
    evento.papelAdmin, evento.acao, evento.alvoTipo,
    evento.alvoId || null, evento.alvoCodigo || null, evento.requestId || null,
    evento.resultado || null, evento.httpStatus || null
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
      AND ($5::TEXT IS NULL OR ($5 = 'PENDENTE' AND r.id IS NULL) OR r.resultado = $5)
  `;
  const join = `LEFT JOIN admin_auditoria_eventos r
    ON r.tentativa_id = i.tentativa_id AND r.fase = 'RESULTADO'`;
  const [count, records] = await Promise.all([
    executor.query(`SELECT COUNT(*)::INT AS total FROM admin_auditoria_eventos i ${join} ${where}`, filtros),
    executor.query(`
      SELECT i.tentativa_id, i.ator_usuario_id, i.papel_admin,
        i.acao, i.alvo_tipo, COALESCE(r.alvo_id, i.alvo_id) AS alvo_id,
        i.alvo_codigo,
        i.request_id, i.ocorrido_em AS iniciado_em,
        r.ocorrido_em AS finalizado_em, r.resultado, r.http_status
      FROM admin_auditoria_eventos i
      ${join}
      ${where}
      ORDER BY i.ocorrido_em DESC, i.id DESC
      LIMIT $6 OFFSET $7
    `, [...filtros, limite, offset])
  ]);
  return { total: Number(count.rows[0]?.total || 0), rows: records.rows };
}

module.exports = { registrarEvento, listar };
