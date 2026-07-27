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

async function buscarPorId(assinaturaId) {
  const result = await db.query(
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

async function buscarNegocioDono(usuarioId) {
  const result = await db.query(
    `
    SELECT
      n.id,
      n.plano_id
    FROM usuarios_negocios un
    INNER JOIN negocios n
      ON n.id = un.negocio_id
    WHERE un.usuario_id = $1
      AND un.papel = 'dono'
    LIMIT 1
    `,
    [usuarioId]
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

  const result =
    await executor.query(
      `
      UPDATE assinaturas
      SET
        status = 'CANCELED',
        ativo = TRUE,
        data_proxima_cobranca = $3,
        observacoes = CONCAT_WS(
          E'\n',
          NULLIF(observacoes, ''),
          $4
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
  buscarNegocioDono,
  buscarUltimaAssinaturaPorNegocio,
  registrarCancelamento,
  expirarCancelamentoSeNecessario,
  buscarPlano,
  listarPagamentos
};
