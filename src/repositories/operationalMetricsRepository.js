const db = require("../db/db");

async function buscarFilas() {
  const resultado = await db.query(`
    SELECT *
    FROM (
      SELECT
        'webhook_asaas'::TEXT AS fila,
        COUNT(*) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        )::INT AS pendentes,
        COUNT(*) FILTER (WHERE status = 'FAILED')::INT AS falhas,
        MIN(recebido_em) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        ) AS mais_antigo_em
      FROM webhook_eventos

      UNION ALL

      SELECT
        'whatsapp'::TEXT AS fila,
        COUNT(*) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        )::INT AS pendentes,
        COUNT(*) FILTER (WHERE status = 'FAILED')::INT AS falhas,
        MIN(created_at) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        ) AS mais_antigo_em
      FROM whatsapp_mensagens

      UNION ALL

      SELECT
        'conversoes_marketing'::TEXT AS fila,
        COUNT(*) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        )::INT AS pendentes,
        COUNT(*) FILTER (WHERE status = 'FAILED')::INT AS falhas,
        MIN(created_at) FILTER (
          WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')
        ) AS mais_antigo_em
      FROM marketing_conversoes_entregas
    ) filas
    ORDER BY fila
  `);

  return resultado.rows;
}

module.exports = {
  buscarFilas,
};
