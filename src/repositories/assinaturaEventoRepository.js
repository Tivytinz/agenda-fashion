const db = require("../db/db");

const STATUS_PAGAMENTO_VALIDO = [
  "CONFIRMED",
  "RECEIVED",
  "RECEIVED_IN_CASH",
];

async function registrar(
  client,
  {
    negocioId,
    assinaturaId = null,
    pagamentoId = null,
    tipo,
    motivo = null,
    planoAnteriorId = null,
    planoNovoId = null,
    origem,
    detalhes = {},
    valorMensalAnterior = null,
    valorMensalNovo = null,
    periodicidadeSnapshot = null,
    ocorridoEm = null,
    chaveIdempotencia,
  }
) {
  const executor = client || db;

  const resultado = await executor.query(
    `
    INSERT INTO assinatura_eventos (
      negocio_id,
      assinatura_id,
      pagamento_id,
      tipo,
      motivo,
      plano_anterior_id,
      plano_novo_id,
      origem,
      detalhes,
      valor_mensal_anterior,
      valor_mensal_novo,
      periodicidade_snapshot,
      ocorrido_em,
      chave_idempotencia
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9::jsonb,
      $10::numeric, $11::numeric, $12,
      COALESCE($13::timestamptz, NOW()),
      $14
    )
    ON CONFLICT (chave_idempotencia)
    DO NOTHING
    RETURNING *
    `,
    [
      negocioId,
      assinaturaId,
      pagamentoId,
      tipo,
      motivo,
      planoAnteriorId,
      planoNovoId,
      origem,
      JSON.stringify(detalhes || {}),
      valorMensalAnterior,
      valorMensalNovo,
      periodicidadeSnapshot,
      ocorridoEm,
      chaveIdempotencia,
    ]
  );

  return resultado.rows[0] || null;
}

async function buscarContextoPagamento(
  client,
  {
    assinaturaId,
    pagamentoId,
  }
) {
  const executor = client || db;

  const resultado = await executor.query(
    `
    SELECT
      a.negocio_id,
      a.plano_id,
      a.valor AS valor_recorrente_atual,
      a.periodicidade AS periodicidade_atual,
      n.plano_id AS plano_negocio_atual_id,
      (
        SELECT fronteira.tipo
        FROM assinatura_eventos fronteira
        WHERE fronteira.negocio_id = a.negocio_id
          AND fronteira.tipo IN (
            'EPISODIO_PAGO_BASELINE',
            'CONVERSAO_INICIAL',
            'REATIVACAO_PAGA',
            'ACESSO_PAGO_ENCERRADO'
          )
        ORDER BY
          fronteira.ocorrido_em DESC,
          fronteira.id DESC
        LIMIT 1
      ) AS ultimo_evento_episodio_tipo,
      EXISTS (
        SELECT 1
        FROM pagamentos anterior
        WHERE anterior.assinatura_id = a.id
          AND anterior.id <> atual.id
          AND UPPER(anterior.status) = ANY($3::text[])
          AND anterior.data_pagamento IS NOT NULL
          AND (
            anterior.data_pagamento < atual.data_pagamento
            OR (
              anterior.data_pagamento = atual.data_pagamento
              AND anterior.id < atual.id
            )
          )
      ) AS possui_pagamento_valido_mesma_assinatura,
      EXISTS (
        SELECT 1
        FROM pagamentos anterior
        INNER JOIN assinaturas assinatura_anterior
          ON assinatura_anterior.id = anterior.assinatura_id
        INNER JOIN planos plano_anterior
          ON plano_anterior.id = assinatura_anterior.plano_id
        WHERE assinatura_anterior.negocio_id = a.negocio_id
          AND assinatura_anterior.id <> a.id
          AND plano_anterior.valor > 0
          AND UPPER(anterior.status) = ANY($3::text[])
          AND anterior.data_pagamento IS NOT NULL
          AND (
            anterior.data_pagamento < atual.data_pagamento
            OR (
              anterior.data_pagamento = atual.data_pagamento
              AND anterior.id < atual.id
            )
          )
      ) AS possui_historico_pago_anterior,
      (
        SELECT ativa.id
        FROM assinaturas ativa
        INNER JOIN planos plano_ativo
          ON plano_ativo.id = ativa.plano_id
        WHERE ativa.negocio_id = a.negocio_id
          AND ativa.id <> a.id
          AND ativa.ativo = TRUE
          AND plano_ativo.valor > 0
        ORDER BY ativa.id DESC
        LIMIT 1
      ) AS outra_assinatura_ativa_id,
      (
        SELECT ativa.plano_id
        FROM assinaturas ativa
        INNER JOIN planos plano_ativo
          ON plano_ativo.id = ativa.plano_id
        WHERE ativa.negocio_id = a.negocio_id
          AND ativa.id <> a.id
          AND ativa.ativo = TRUE
          AND plano_ativo.valor > 0
        ORDER BY ativa.id DESC
        LIMIT 1
      ) AS plano_ativo_anterior_id,
      (
        SELECT ativa.valor
        FROM assinaturas ativa
        INNER JOIN planos plano_ativo
          ON plano_ativo.id = ativa.plano_id
        WHERE ativa.negocio_id = a.negocio_id
          AND ativa.id <> a.id
          AND ativa.ativo = TRUE
          AND plano_ativo.valor > 0
        ORDER BY ativa.id DESC
        LIMIT 1
      ) AS valor_recorrente_ativo_anterior,
      (
        SELECT ativa.periodicidade
        FROM assinaturas ativa
        INNER JOIN planos plano_ativo
          ON plano_ativo.id = ativa.plano_id
        WHERE ativa.negocio_id = a.negocio_id
          AND ativa.id <> a.id
          AND ativa.ativo = TRUE
          AND plano_ativo.valor > 0
        ORDER BY ativa.id DESC
        LIMIT 1
      ) AS periodicidade_ativa_anterior,
      (
        SELECT assinatura_anterior.plano_id
        FROM pagamentos anterior
        INNER JOIN assinaturas assinatura_anterior
          ON assinatura_anterior.id = anterior.assinatura_id
        INNER JOIN planos plano_anterior
          ON plano_anterior.id = assinatura_anterior.plano_id
        WHERE assinatura_anterior.negocio_id = a.negocio_id
          AND assinatura_anterior.id <> a.id
          AND plano_anterior.valor > 0
          AND UPPER(anterior.status) = ANY($3::text[])
          AND anterior.data_pagamento IS NOT NULL
          AND (
            anterior.data_pagamento < atual.data_pagamento
            OR (
              anterior.data_pagamento = atual.data_pagamento
              AND anterior.id < atual.id
            )
          )
        ORDER BY
          anterior.data_pagamento DESC,
          anterior.id DESC
        LIMIT 1
      ) AS ultimo_plano_pago_anterior_id,
      (
        SELECT assinatura_anterior.valor
        FROM pagamentos anterior
        INNER JOIN assinaturas assinatura_anterior
          ON assinatura_anterior.id = anterior.assinatura_id
        INNER JOIN planos plano_anterior
          ON plano_anterior.id = assinatura_anterior.plano_id
        WHERE assinatura_anterior.negocio_id = a.negocio_id
          AND assinatura_anterior.id <> a.id
          AND plano_anterior.valor > 0
          AND UPPER(anterior.status) = ANY($3::text[])
          AND anterior.data_pagamento IS NOT NULL
          AND (
            anterior.data_pagamento < atual.data_pagamento
            OR (
              anterior.data_pagamento = atual.data_pagamento
              AND anterior.id < atual.id
            )
          )
        ORDER BY
          anterior.data_pagamento DESC,
          anterior.id DESC
        LIMIT 1
      ) AS ultimo_valor_recorrente_pago_anterior,
      (
        SELECT assinatura_anterior.periodicidade
        FROM pagamentos anterior
        INNER JOIN assinaturas assinatura_anterior
          ON assinatura_anterior.id = anterior.assinatura_id
        INNER JOIN planos plano_anterior
          ON plano_anterior.id = assinatura_anterior.plano_id
        WHERE assinatura_anterior.negocio_id = a.negocio_id
          AND assinatura_anterior.id <> a.id
          AND plano_anterior.valor > 0
          AND UPPER(anterior.status) = ANY($3::text[])
          AND anterior.data_pagamento IS NOT NULL
          AND (
            anterior.data_pagamento < atual.data_pagamento
            OR (
              anterior.data_pagamento = atual.data_pagamento
              AND anterior.id < atual.id
            )
          )
        ORDER BY
          anterior.data_pagamento DESC,
          anterior.id DESC
        LIMIT 1
      ) AS ultima_periodicidade_paga_anterior
    FROM assinaturas a
    INNER JOIN pagamentos atual
      ON atual.id = $2
      AND atual.assinatura_id = a.id
    INNER JOIN negocios n
      ON n.id = a.negocio_id
    WHERE a.id = $1
    LIMIT 1
    `,
    [
      assinaturaId,
      pagamentoId,
      STATUS_PAGAMENTO_VALIDO,
    ]
  );

  return resultado.rows[0] || null;
}

async function teveAtrasoProcessado(
  client,
  asaasPaymentId
) {
  if (!asaasPaymentId) {
    return false;
  }

  const executor = client || db;
  const resultado = await executor.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM webhook_eventos
      WHERE provedor = 'asaas'
        AND recurso_id = $1
        AND tipo_evento = 'PAYMENT_OVERDUE'
        AND status = 'PROCESSED'
    ) AS possui_atraso
    `,
    [asaasPaymentId]
  );

  return resultado.rows[0]?.possui_atraso === true;
}

async function teveEventoPagamento(
  client,
  pagamentoId,
  tipo
) {
  const executor = client || db;
  const resultado = await executor.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM assinatura_eventos
      WHERE pagamento_id = $1
        AND tipo = $2
    ) AS possui_evento
    `,
    [pagamentoId, tipo]
  );

  return resultado.rows[0]?.possui_evento === true;
}

async function buscarUltimoPorAssinaturaETipo(
  client,
  assinaturaId,
  tipo
) {
  const executor = client || db;
  const resultado = await executor.query(
    `
    SELECT *
    FROM assinatura_eventos
    WHERE assinatura_id = $1
      AND tipo = $2
    ORDER BY ocorrido_em DESC, id DESC
    LIMIT 1
    `,
    [assinaturaId, tipo]
  );

  return resultado.rows[0] || null;
}

async function listarPorNegocio(
  negocioId,
  {
    limite = 100,
    executor = db,
  } = {}
) {
  const resultado = await executor.query(
    `
    SELECT
      id,
      negocio_id,
      assinatura_id,
      pagamento_id,
      tipo,
      motivo,
      plano_anterior_id,
      plano_novo_id,
      origem,
      detalhes,
      valor_mensal_anterior,
      valor_mensal_novo,
      periodicidade_snapshot,
      ocorrido_em,
      created_at
    FROM assinatura_eventos
    WHERE negocio_id = $1
    ORDER BY ocorrido_em DESC, id DESC
    LIMIT $2
    `,
    [negocioId, limite]
  );

  return resultado.rows;
}

module.exports = {
  registrar,
  buscarContextoPagamento,
  teveAtrasoProcessado,
  teveEventoPagamento,
  buscarUltimoPorAssinaturaETipo,
  listarPorNegocio,
};
