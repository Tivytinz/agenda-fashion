const db = require("../db/db");

async function buscarNegocioDono(client, usuarioId) {
  const executor = client || db;

  const result = await executor.query(
    `
    SELECT
      n.id,
      n.nome,
      n.asaas_customer_id
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
    WHERE pg.asaas_payment_id = $1
      AND un.usuario_id = $2
    LIMIT 1
    `,
    [pagamentoId, usuarioId]
  );

  return result.rows[0] || null;
}

module.exports = {
  buscarNegocioDono,
  buscarPlano,
  buscarPagamentoCheckout
};