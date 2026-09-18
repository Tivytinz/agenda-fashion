const db = require("../db/db");

async function buscarNegocioDono(client, usuarioId) {
  const executor = client || db;

  const result = await executor.query(
    `
    SELECT
      n.id,
      n.nome,
      n.plano_id,
      n.asaas_customer_id
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

async function buscarPlano(client, planoId) {
  const executor = client || db;

  const result = await executor.query(
    `
    SELECT
      id,
      nome,
      slug,
      valor
    FROM planos
    WHERE id = $1
      AND ativo = true
    LIMIT 1
    `,
    [planoId]
  );

  return result.rows[0] || null;
}

async function bloquearCheckoutDoNegocio(
  client,
  negocioId
) {
  await client.query(
    `
    SELECT pg_advisory_xact_lock(
      hashtext('agenda_fashion_checkout_pix'),
      $1::integer
    )
    `,
    [Number(negocioId)]
  );
}

async function buscarAssinaturaPendenteDoNegocio(
  client,
  negocioId
) {
  const result = await client.query(
    `
    SELECT
      a.id,
      a.negocio_id,
      a.plano_id,
      a.status,
      a.created_at,
      p.nome AS plano_nome,
      p.slug AS plano_slug
    FROM assinaturas a
    INNER JOIN planos p
      ON p.id = a.plano_id
    WHERE a.negocio_id = $1
      AND a.ativo = FALSE
      AND UPPER(a.status) IN (
        'PENDING',
        'PENDING_PAYMENT'
      )
      AND (
        a.created_at >= NOW() - INTERVAL '15 minutes'
        OR EXISTS (
          SELECT 1
          FROM pagamentos pg
          WHERE pg.assinatura_id = a.id
            AND UPPER(pg.status) IN (
              'PENDING',
              'CREATED',
              'AWAITING_PAYMENT'
            )
            AND (
              pg.data_vencimento IS NULL
              OR pg.data_vencimento >= CURRENT_DATE
            )
        )
      )
    ORDER BY a.id DESC
    LIMIT 1
    FOR UPDATE OF a
    `,
    [negocioId]
  );

  return result.rows[0] || null;
}

async function buscarDadosClienteAsaas(
  client,
  negocioId,
  usuarioId
) {
  const result = await client.query(
    `
      SELECT
        n.nome AS nome_negocio,
        n.whatsapp AS telefone_negocio,
        u.nome AS nome_dono,
        u.email AS email_dono,
        u.whatsapp AS telefone_dono
      FROM negocios n
      INNER JOIN usuarios_negocios un
        ON un.negocio_id = n.id
      INNER JOIN usuarios u
        ON u.id = un.usuario_id
      WHERE n.id = $1
        AND un.usuario_id = $2
        AND un.papel = 'dono'
        AND un.ativo = TRUE
      LIMIT 1
    `,
    [negocioId, usuarioId]
  );

  return result.rows[0] || null;
}

async function salvarClienteAsaasSeAusente(
  client,
  negocioId,
  asaasCustomerId
) {
  const atualizacao = await client.query(
    `
      UPDATE negocios
      SET asaas_customer_id = $1
      WHERE id = $2
        AND asaas_customer_id IS NULL
      RETURNING asaas_customer_id
    `,
    [asaasCustomerId, negocioId]
  );

  if (atualizacao.rows[0]) {
    return atualizacao.rows[0].asaas_customer_id;
  }

  const consulta = await client.query(
    `
      SELECT asaas_customer_id
      FROM negocios
      WHERE id = $1
      LIMIT 1
    `,
    [negocioId]
  );

  return consulta.rows[0]?.asaas_customer_id || null;
}

async function buscarPagamentoCheckout(pagamentoId, usuarioId) {
  const result = await db.query(
    `
    SELECT
      pg.id,
      pg.asaas_payment_id,
      pg.status,
      a.ativo,
      a.status AS status_assinatura,
      p.nome AS plano_nome
    FROM pagamentos pg
    INNER JOIN assinaturas a
      ON a.id = pg.assinatura_id
    INNER JOIN planos p
      ON p.id = a.plano_id
    INNER JOIN usuarios_negocios un
      ON un.negocio_id = a.negocio_id
    INNER JOIN usuarios u
      ON u.id = un.usuario_id
    WHERE pg.asaas_payment_id = $1
      AND un.usuario_id = $2
      AND un.papel = 'dono'
      AND un.ativo = TRUE
      AND u.ativo = TRUE
    LIMIT 1
    `,
    [pagamentoId, usuarioId]
  );

  return result.rows[0] || null;
}

async function buscarEstadoAtivacaoPagamento(pagamentoId) {
  const result = await db.query(
    `
    SELECT
      status,
      tentativas,
      proxima_tentativa_em,
      erro,
      (
        status = 'FAILED'
        AND tentativas >= 10
        AND proxima_tentativa_em IS NULL
      ) AS falha_terminal
    FROM webhook_eventos
    WHERE provedor = 'asaas'
      AND recurso_id = $1
      AND (
        tipo_evento IN (
          'PAYMENT_CONFIRMED',
          'PAYMENT_RECEIVED'
        )
        OR UPPER(
          COALESCE(
            payload -> 'payment' ->> 'status',
            ''
          )
        ) IN (
          'CONFIRMED',
          'RECEIVED',
          'RECEIVED_IN_CASH'
        )
      )
    ORDER BY recebido_em DESC, id DESC
    LIMIT 1
    `,
    [pagamentoId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarNegocioDono,
  buscarPlano,
  bloquearCheckoutDoNegocio,
  buscarAssinaturaPendenteDoNegocio,
  buscarDadosClienteAsaas,
  salvarClienteAsaasSeAusente,
  buscarPagamentoCheckout,
  buscarEstadoAtivacaoPagamento
};
