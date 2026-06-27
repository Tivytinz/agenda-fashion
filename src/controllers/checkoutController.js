const db = require("../db");

const {
  criarAssinaturaAsaas,
  listarPagamentosAssinatura,
  buscarQrCodePix
} = require("../services/asaasService");

async function criarCheckout(req, res) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const usuarioId = req.user?.id;
    const { plano_id, forma_pagamento } = req.body;

    if (!usuarioId) {
      await client.query("ROLLBACK");
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!plano_id || !["pix", "cartao"].includes(forma_pagamento)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ erro: "Dados de checkout inválidos." });
    }

    const negocioResult = await client.query(
      `
      SELECT n.id, n.nome, n.asaas_customer_id
      FROM usuarios_negocios un
      INNER JOIN negocios n ON n.id = un.negocio_id
      WHERE un.usuario_id = $1
        AND un.papel = 'dono'
      LIMIT 1
      `,
      [usuarioId]
    );

    if (negocioResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    const negocio = negocioResult.rows[0];

    if (!negocio.asaas_customer_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        erro: "Cliente Asaas não encontrado para este negócio."
      });
    }

    const planoResult = await client.query(
      `
      SELECT id, nome, slug, valor
      FROM planos
      WHERE id = $1
        AND ativo = true
      LIMIT 1
      `,
      [plano_id]
    );

    if (planoResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ erro: "Plano não encontrado." });
    }

    const plano = planoResult.rows[0];

    if (Number(plano.valor || 0) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        erro: "Este plano não precisa de pagamento."
      });
    }

    const assinaturaAsaas = await criarAssinaturaAsaas({
      customerId: negocio.asaas_customer_id,
      valor: plano.valor,
      descricao: `Agenda Fashion - Plano ${plano.nome}`,
      formaPagamento: forma_pagamento,
      externalReference: `negocio:${negocio.id};plano:${plano.id}`
    });

    const assinaturaResult = await client.query(
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
        ativo
      )
      VALUES (
        $1, $2, $3, $4,
        'PENDING',
        $5,
        'MONTHLY',
        $6,
        $7,
        false
      )
      RETURNING *
      `,
      [
        negocio.id,
        plano.id,
        negocio.asaas_customer_id,
        assinaturaAsaas.id,
        forma_pagamento,
        plano.valor,
        assinaturaAsaas.nextDueDate || null
      ]
    );

    const assinaturaLocal = assinaturaResult.rows[0];

    let pagamento = null;
    let pix = null;

    const pagamentosAsaas = await listarPagamentosAssinatura(assinaturaAsaas.id);

    if (pagamentosAsaas?.data?.length) {
      pagamento = pagamentosAsaas.data[0];

      if (forma_pagamento === "pix") {
        pix = await buscarQrCodePix(pagamento.id);
      }

      await client.query(
        `
        INSERT INTO pagamentos (
          assinatura_id,
          asaas_payment_id,
          valor,
          forma_pagamento,
          status,
          data_vencimento,
          pix_copia_cola,
          pix_qrcode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          assinaturaLocal.id,
          pagamento.id,
          pagamento.value || plano.valor,
          forma_pagamento,
          pagamento.status || "PENDING",
          pagamento.dueDate || null,
          pix?.payload || null,
          pix?.encodedImage || null
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      mensagem: "Assinatura criada com sucesso.",
      assinatura: assinaturaLocal,
      pagamento,
      pix
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error("Erro no checkout:", err.response?.data || err);

    return res.status(500).json({
      erro: "Erro ao criar checkout."
    });

  } finally {
    client.release();
  }
}

module.exports = {
  criarCheckout
};