const db = require("../db/db");

function executorConsulta(client) {
  return client || db;
}

async function ehPrimeiroPagamentoAssinatura({
  assinaturaId,
  pagamentoId,
  client = null
}) {
  const resultado = await executorConsulta(client)
    .query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM pagamentos atual
        WHERE atual.assinatura_id = $1
          AND atual.asaas_payment_id = $2
          AND atual.data_pagamento IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM pagamentos anterior
            WHERE anterior.assinatura_id =
              atual.assinatura_id
              AND anterior.data_pagamento
                IS NOT NULL
              AND (
                anterior.data_pagamento <
                  atual.data_pagamento
                OR (
                  anterior.data_pagamento =
                    atual.data_pagamento
                  AND anterior.id < atual.id
                )
              )
          )
      ) AS primeiro_pagamento
      `,
      [
        assinaturaId,
        pagamentoId
      ]
    );

  return resultado.rows[0]
    ?.primeiro_pagamento === true;
}

async function buscarPagamentoConfirmado({
  assinaturaId,
  pagamentoId,
  client = null
}) {
  const resultado = await executorConsulta(client)
    .query(
      `
      SELECT
        p.id,
        p.assinatura_id,
        p.asaas_payment_id,
        p.valor,
        p.data_pagamento
      FROM pagamentos p
      WHERE p.assinatura_id = $1
        AND p.asaas_payment_id = $2
        AND p.data_pagamento IS NOT NULL
      LIMIT 1
      `,
      [
        assinaturaId,
        pagamentoId
      ]
    );

  return resultado.rows[0] || null;
}

module.exports = {
  ehPrimeiroPagamentoAssinatura,
  buscarPagamentoConfirmado
};