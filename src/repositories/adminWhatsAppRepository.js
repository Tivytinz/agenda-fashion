const db = require(
  "../db/db"
);

async function buscarMetricasPorTemplate(
  periodo
) {
  const result = await db.query(
    `
      SELECT
        tipo,
        COUNT(*)::INTEGER AS total,
        COUNT(*) FILTER (
          WHERE status IN (
            'PENDING',
            'PROCESSING'
          )
        )::INTEGER AS pendentes,
        COUNT(*) FILTER (
          WHERE meta_message_id IS NOT NULL
        )::INTEGER AS aceitas,
        COUNT(*) FILTER (
          WHERE status = 'FAILED'
        )::INTEGER AS falhas_fila,
        COUNT(*) FILTER (
          WHERE status = 'CANCELED'
        )::INTEGER AS canceladas,
        COUNT(*) FILTER (
          WHERE entregue_em IS NOT NULL
        )::INTEGER AS entregues,
        COUNT(*) FILTER (
          WHERE lida_em IS NOT NULL
        )::INTEGER AS lidas,
        COUNT(*) FILTER (
          WHERE falhou_em IS NOT NULL
        )::INTEGER AS falhas_entrega
      FROM whatsapp_mensagens
      WHERE CASE $1::TEXT
        WHEN 'hoje' THEN
          created_at >= (
            DATE_TRUNC(
              'day',
              NOW() AT TIME ZONE
                'America/Sao_Paulo'
            ) AT TIME ZONE
              'America/Sao_Paulo'
          )
        WHEN '7' THEN
          created_at >= NOW() - INTERVAL '7 days'
        WHEN '30' THEN
          created_at >= NOW() - INTERVAL '30 days'
        WHEN '90' THEN
          created_at >= NOW() - INTERVAL '90 days'
        ELSE TRUE
      END
      GROUP BY tipo
      ORDER BY tipo
    `,
    [periodo]
  );

  return result.rows;
}

module.exports = {
  buscarMetricasPorTemplate,
};
