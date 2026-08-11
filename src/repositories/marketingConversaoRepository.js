const db = require("../db/db");

async function ehPrimeiroPagamentoAssinatura({
  assinaturaId,
  pagamentoId
}) {
  const resultado = await db.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE p.data_pagamento IS NOT NULL
      )::INT AS pagamentos_confirmados,
      BOOL_OR(
        p.asaas_payment_id = $2
        AND p.data_pagamento IS NOT NULL
      ) AS pagamento_atual_confirmado
    FROM pagamentos p
    INNER JOIN assinaturas a
      ON a.id = p.assinatura_id
    WHERE p.assinatura_id = $1
      AND a.ativo = TRUE
      AND UPPER(a.status) = 'ACTIVE'
    `,
    [
      assinaturaId,
      pagamentoId
    ]
  );

  const linha = resultado.rows[0] || {};

  return (
    Number(linha.pagamentos_confirmados) === 1 &&
    linha.pagamento_atual_confirmado === true
  );
}

module.exports = {
  ehPrimeiroPagamentoAssinatura
};
