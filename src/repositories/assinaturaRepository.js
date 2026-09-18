const db = require("../db/db");

async function criarAssinatura(client, dados) {
  const executor = client || db;

  const result = await executor.query(
    `
    INSERT INTO assinaturas (
      negocio_id,
      plano_id,
      asaas_customer_id,
      asaas_subscription_id,
      status,
      forma_pagamento,
      periodicidade,
      valor,
      data_proxima_cobranca,
      ativo,
      observacoes
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11
    )
    RETURNING *
    `,
    [
      dados.negocio_id,
      dados.plano_id,
      dados.asaas_customer_id || null,
      dados.asaas_subscription_id || null,
      dados.status || "PENDING",
      dados.forma_pagamento || null,
      dados.periodicidade || "MONTHLY",
      dados.valor,
      dados.data_proxima_cobranca || null,
      dados.ativo || false,
      dados.observacoes || null
    ]
  );

  return result.rows[0];
}

async function buscarAssinaturaAtivaPorNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT *
    FROM assinaturas
    WHERE negocio_id = $1
      AND ativo = true
    ORDER BY id DESC
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function buscarPorSubscriptionId(subscriptionId) {
  const result = await db.query(
    `
    SELECT *
    FROM assinaturas
    WHERE asaas_subscription_id = $1
    LIMIT 1
    `,
    [subscriptionId]
  );

  return result.rows[0] || null;
}

async function ativarAssinatura(client, assinaturaId) {
  const executor = client || db;

  const result = await executor.query(
    `
    UPDATE assinaturas
    SET
      status = 'ACTIVE',
      ativo = true,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [assinaturaId]
  );

  return result.rows[0] || null;
}

async function desativarAssinaturasDoNegocio(client, negocioId) {
  const executor = client || db;

  await executor.query(
    `
    UPDATE assinaturas
    SET
      ativo = false,
      updated_at = NOW()
    WHERE negocio_id = $1
    `,
    [negocioId]
  );
}

async function buscarPorId(
  assinaturaId,
  executor = db
) {
  const result = await executor.query(
    `
    SELECT *
    FROM assinaturas
    WHERE id = $1
    LIMIT 1
    `,
    [assinaturaId]
  );

  return result.rows[0] || null;
}

async function tocarAssinaturaPendenteCheckout(
  assinaturaId,
  executor = db
) {
  const result = await executor.query(
    `
    UPDATE assinaturas
    SET updated_at = NOW()
    WHERE id = $1
      AND ativo = FALSE
      AND UPPER(status) IN (
        'PENDING',
        'PENDING_PAYMENT'
      )
    RETURNING *
    `,
    [assinaturaId]
  );

  return result.rows[0] || null;
}

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT
      n.id,
      n.plano_id
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND n.ativo = TRUE
      AND u.ativo = TRUE
    LIMIT 1
    `,
    [usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarAssinaturaPendentePorNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT a.*
    FROM assinaturas a
    WHERE a.negocio_id = $1
      AND a.ativo = FALSE
      AND UPPER(a.status) IN (
        'PENDING',
        'PENDING_PAYMENT'
      )
      AND a.id > COALESCE(
        (
          SELECT MAX(ativa.id)
          FROM assinaturas ativa
          WHERE ativa.negocio_id = a.negocio_id
            AND ativa.ativo = TRUE
        ),
        0
      )
      AND (
        GREATEST(
          a.created_at,
          a.updated_at
        ) >= NOW() - INTERVAL '15 minutes'
        OR EXISTS (
          SELECT 1
          FROM pagamentos pg
          WHERE pg.assinatura_id = a.id
            AND (
              (
                UPPER(pg.status) IN (
                  'PENDING',
                  'CREATED',
                  'AWAITING_PAYMENT'
                )
                AND (
                  pg.data_vencimento IS NULL
                  OR pg.data_vencimento >= CURRENT_DATE
                )
              )
              OR UPPER(pg.status) IN (
                'CONFIRMED',
                'RECEIVED',
                'RECEIVED_IN_CASH'
              )
            )
        )
      )
    ORDER BY a.id DESC
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function buscarUltimaAssinaturaPorNegocio(negocioId) {
  const result = await db.query(
    `
    SELECT *
    FROM assinaturas
    WHERE negocio_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function registrarCancelamento(
  client,
  {
    assinaturaId,
    negocioId,
    acessoAte,
    observacoes
  }
) {
  const executor = client || db;

  const result = await executor.query(
    `
    UPDATE assinaturas
    SET
      status = 'CANCELED',
      ativo = TRUE,
      data_proxima_cobranca = $3,
      observacoes = CONCAT_WS(
        E'\n',
        NULLIF(observacoes, ''),
        $4::text
      ),
      updated_at = NOW()
    WHERE id = $1
      AND negocio_id = $2
      AND ativo = TRUE
    RETURNING *
    `,
    [
      assinaturaId,
      negocioId,
      acessoAte,
      observacoes
    ]
  );

  return result.rows[0] || null;
}

async function expirarCancelamentoSeNecessario(
  negocioId,
  executor = db
) {
  const result =
    await executor.query(
      `
      WITH plano_gratis AS (
        SELECT id
        FROM planos
        WHERE slug = 'inicial'
          AND ativo = TRUE
        LIMIT 1
      ),
      negocio_atualizado AS (
        UPDATE negocios n
        SET plano_id = pg.id
        FROM plano_gratis pg
        WHERE n.id = $1
          AND EXISTS (
            SELECT 1
            FROM assinaturas a
            WHERE a.negocio_id = n.id
              AND a.ativo = TRUE
              AND a.status IN (
                'CANCELED',
                'CANCELLED'
              )
              AND a.data_proxima_cobranca
                IS NOT NULL
              AND a.data_proxima_cobranca
                <= CURRENT_DATE
          )
        RETURNING n.id
      )
      UPDATE assinaturas a
      SET
        ativo = FALSE,
        updated_at = NOW()
      FROM negocio_atualizado na
      WHERE a.negocio_id = na.id
        AND a.ativo = TRUE
        AND a.status IN (
          'CANCELED',
          'CANCELLED'
        )
        AND a.data_proxima_cobranca
          IS NOT NULL
        AND a.data_proxima_cobranca
          <= CURRENT_DATE
      RETURNING a.*
      `,
      [negocioId]
    );

  return result.rows[0] || null;
}

async function buscarPlano(planoId) {
  const result = await db.query(
    `
    SELECT
      id,
      nome,
      slug,
      valor,
      capacidade_agendamentos
    FROM planos
    WHERE id = $1
    LIMIT 1
    `,
    [planoId]
  );

  return result.rows[0] || null;
}

async function buscarUltimoPagamentoPendente(
  assinaturaId
) {
  const result = await db.query(
    `
    SELECT
      pg.id,
      pg.asaas_payment_id,
      pg.valor,
      pg.forma_pagamento,
      pg.status,
      pg.data_vencimento,
      pg.data_pagamento,
      pg.pix_copia_cola,
      pg.pix_qrcode,
      pg.created_at,
      we.status AS webhook_status,
      we.tentativas AS webhook_tentativas,
      we.proxima_tentativa_em,
      (
        we.status = 'FAILED'
        AND we.tentativas >= 10
        AND we.proxima_tentativa_em IS NULL
      ) AS ativacao_requer_atencao
    FROM pagamentos pg
    LEFT JOIN LATERAL (
      SELECT
        w.status,
        w.tentativas,
        w.proxima_tentativa_em
      FROM webhook_eventos w
      WHERE w.provedor = 'asaas'
        AND w.recurso_id = pg.asaas_payment_id
        AND (
          w.tipo_evento IN (
            'PAYMENT_CONFIRMED',
            'PAYMENT_RECEIVED'
          )
          OR UPPER(
            COALESCE(
              w.payload -> 'payment' ->> 'status',
              ''
            )
          ) IN (
            'CONFIRMED',
            'RECEIVED',
            'RECEIVED_IN_CASH'
          )
        )
      ORDER BY w.recebido_em DESC, w.id DESC
      LIMIT 1
    ) we ON TRUE
    WHERE pg.assinatura_id = $1
      AND (
        (
          UPPER(pg.status) IN (
            'PENDING',
            'CREATED',
            'AWAITING_PAYMENT'
          )
          AND (
            pg.data_vencimento IS NULL
            OR pg.data_vencimento >= CURRENT_DATE
          )
        )
        OR UPPER(pg.status) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
      )
    ORDER BY pg.id DESC
    LIMIT 1
    `,
    [assinaturaId]
  );

  return result.rows[0] || null;
}

async function listarPagamentos(assinaturaId) {
  const result = await db.query(
    `
    SELECT
      id,
      asaas_payment_id,
      valor,
      forma_pagamento,
      status,
      data_vencimento,
      data_pagamento,
      created_at
    FROM pagamentos
    WHERE assinatura_id = $1
    ORDER BY id DESC
    LIMIT 12
    `,
    [assinaturaId]
  );

  return result.rows;
}

module.exports = {
  criarAssinatura,
  buscarAssinaturaAtivaPorNegocio,
  buscarPorSubscriptionId,
  ativarAssinatura,
  desativarAssinaturasDoNegocio,
  buscarPorId,
  tocarAssinaturaPendenteCheckout,
  buscarNegocioDono,
  buscarUltimaAssinaturaPorNegocio,
  buscarAssinaturaPendentePorNegocio,
  registrarCancelamento,
  expirarCancelamentoSeNecessario,
  buscarPlano,
  buscarUltimoPagamentoPendente,
  listarPagamentos
};
