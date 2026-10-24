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

      UNION ALL

      SELECT
        'renovacoes_assinatura'::TEXT AS fila,
        COUNT(*) FILTER (WHERE estado IN ('PENDING', 'REMOVING'))::INT AS pendentes,
        COUNT(*) FILTER (WHERE estado IN ('PENDING', 'REMOVING') AND ultima_falha_em IS NOT NULL)::INT AS falhas,
        MIN(criado_em) FILTER (WHERE estado IN ('PENDING', 'REMOVING')) AS mais_antigo_em
      FROM assinatura_renovacao_operacoes

      UNION ALL

      SELECT 'checkouts_assinatura'::TEXT AS fila,
        COUNT(*) FILTER (WHERE estado IN ('PENDING', 'REMOVING'))::INT AS pendentes,
        COUNT(*) FILTER (WHERE estado IN ('PENDING', 'REMOVING') AND ultima_falha_em IS NOT NULL)::INT AS falhas,
        MIN(criado_em) FILTER (WHERE estado IN ('PENDING', 'REMOVING')) AS mais_antigo_em
      FROM assinatura_checkout_operacoes
    ) filas
    ORDER BY fila
  `);

  return resultado.rows;
}

module.exports = {
  buscarFilas,
};
