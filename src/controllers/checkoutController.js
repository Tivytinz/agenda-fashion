const db = require("../db");

const {
  criarAssinaturaAsaas,
  criarCobrancaPix,
  buscarQrCodePix,
  atualizarClienteAsaas,
  buscarPagamentoAsaas
} = require("../services/asaasService");

const {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento
} = require("../services/assinaturaService");

async function buscarNegocioDono(client, usuarioId) {
  const result = await client.query(
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

  return result.rows[0] || null;
}

async function buscarPlano(client, planoId) {
  const result = await client.query(
    `
    SELECT id, nome, slug, valor
    FROM planos
    WHERE id = $1
      AND ativo = true
    LIMIT 1
    `,
    [planoId]
  );

  return result.rows[0] || null;
}

async function criarCheckoutPix(client, negocio, plano) {
  const assinaturaLocal = await registrarAssinaturaPendente(client, {
    negocio_id: negocio.id,
    plano_id: plano.id,
    asaas_customer_id: negocio.asaas_customer_id,
    asaas_subscription_id: null,
    status: "PENDING",
    forma_pagamento: "pix",
    periodicidade: "MONTHLY",
    valor: plano.valor,
    observacoes:
      "PIX inicial criado. Assinatura recorrente será ativada após confirmação do pagamento."
  });

  await atualizarClienteAsaas(negocio.asaas_customer_id, {
    cpfCnpj: "24971563792"
  });

  const cobranca = await criarCobrancaPix({
    customerId: negocio.asaas_customer_id,
    valor: plano.valor,
    descricao: `Agenda Fashion - Plano ${plano.nome}`,
    externalReference: `assinatura:${assinaturaLocal.id};negocio:${negocio.id};plano:${plano.id}`
  });

  const pix = await buscarQrCodePix(cobranca.id);

  await registrarPagamento(client, {
    assinatura_id: assinaturaLocal.id,
    asaas_payment_id: cobranca.id,
    valor: cobranca.value || plano.valor,
    forma_pagamento: "pix",
    status: cobranca.status || "PENDING",
    data_vencimento: cobranca.dueDate || null,
    pix_copia_cola: pix?.payload || null,
    pix_qrcode: pix?.encodedImage || null
  });

  return {
    assinatura: assinaturaLocal,
    pagamento: cobranca,
    pix
  };
}

async function criarCheckoutCartao(client, negocio, plano, cartao) {
  const assinaturaAsaas = await criarAssinaturaAsaas({
    customerId: negocio.asaas_customer_id,
    valor: plano.valor,
    descricao: `Agenda Fashion - Plano ${plano.nome}`,
    formaPagamento: "cartao",
    externalReference: `negocio:${negocio.id};plano:${plano.id}`,
    cartao
  });

  const assinaturaLocal = await registrarAssinaturaPendente(client, {
    negocio_id: negocio.id,
    plano_id: plano.id,
    asaas_customer_id: negocio.asaas_customer_id,
    asaas_subscription_id: assinaturaAsaas.id,
    status: assinaturaAsaas.status || "PENDING",
    forma_pagamento: "cartao",
    periodicidade: "MONTHLY",
    valor: plano.valor,
    data_proxima_cobranca: assinaturaAsaas.nextDueDate || null,
    observacoes: "Assinatura criada via cartão."
  });

  return {
    assinatura: assinaturaLocal,
    assinatura_asaas: assinaturaAsaas
  };
}

async function criarCheckout(req, res) {
  try {
    const client = db;
    const usuarioId = req.user?.id;
    const { plano_id, forma_pagamento, cartao } = req.body;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    if (!plano_id || !["pix", "cartao"].includes(forma_pagamento)) {
      return res.status(400).json({ erro: "Dados de checkout inválidos." });
    }

    if (forma_pagamento === "cartao" && !cartao) {
      return res.status(400).json({ erro: "Dados do cartão não informados." });
    }

    const negocio = await buscarNegocioDono(client, usuarioId);

    if (!negocio) {
      return res.status(404).json({ erro: "Negócio não encontrado." });
    }

    if (!negocio.asaas_customer_id) {
      return res.status(400).json({
        erro: "Cliente Asaas não encontrado para este negócio."
      });
    }

    const plano = await buscarPlano(client, plano_id);

    if (!plano) {
      return res.status(404).json({ erro: "Plano não encontrado." });
    }

    if (Number(plano.valor || 0) <= 0) {
      return res.status(400).json({
        erro: "Este plano não precisa de pagamento."
      });
    }

    let resultado = null;

    if (forma_pagamento === "pix") {
      resultado = await criarCheckoutPix(client, negocio, plano);
    }

    if (forma_pagamento === "cartao") {
      resultado = await criarCheckoutCartao(client, negocio, plano, cartao);
    }

    return res.status(201).json({
      mensagem:
        forma_pagamento === "pix"
          ? "PIX gerado com sucesso."
          : "Assinatura enviada para processamento.",
      forma_pagamento,
      ...resultado
    });

  } catch (err) {
    console.error("Erro no checkout:", err.response?.data || err);

    return res.status(500).json({
      erro: "Erro ao criar checkout."
    });
  }
}

async function consultarStatusCheckout(req, res) {
  try {
    const usuarioId = req.user?.id;
    const { pagamento_id } = req.params;

    if (!usuarioId) {
      return res.status(401).json({ erro: "Usuário não autenticado." });
    }

    let pagamentoAsaas = null;

    try {
      pagamentoAsaas = await buscarPagamentoAsaas(pagamento_id);
    } catch (erroAsaas) {
      console.error("Erro ao consultar pagamento no Asaas:", erroAsaas.response?.data || erroAsaas);
    }

    if (
      pagamentoAsaas &&
      ["CONFIRMED", "RECEIVED"].includes(pagamentoAsaas.status)
    ) {
      await ativarAssinaturaPorPagamento(
        pagamento_id,
        pagamentoAsaas.status
      );
    }

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
      INNER JOIN assinaturas a ON a.id = pg.assinatura_id
      INNER JOIN planos p ON p.id = a.plano_id
      INNER JOIN usuarios_negocios un ON un.negocio_id = a.negocio_id
      WHERE pg.asaas_payment_id = $1
        AND un.usuario_id = $2
      LIMIT 1
      `,
      [pagamento_id, usuarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Pagamento não encontrado." });
    }

    return res.json(result.rows[0]);

  } catch (err) {
    console.error("Erro ao consultar checkout:", err);

    return res.status(500).json({
      erro: "Erro ao consultar pagamento."
    });
  }
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};