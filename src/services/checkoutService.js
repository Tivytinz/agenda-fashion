const db = require("../db/db");

const checkoutRepository = require("../repositories/checkoutRepository");

const {
  criarAssinaturaAsaas,
  criarCobrancaPix,
  buscarQrCodePix,
  atualizarClienteAsaas,
  buscarPagamentoAsaas
} = require("./asaasService");

const {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento
} = require("./assinaturaService");

async function criarCheckoutPix(client, negocio, plano) {
  const assinaturaLocal =
    await registrarAssinaturaPendente(client, {
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
    externalReference:
      `assinatura:${assinaturaLocal.id};negocio:${negocio.id};plano:${plano.id}`
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
  const assinaturaAsaas =
    await criarAssinaturaAsaas({
      customerId: negocio.asaas_customer_id,
      valor: plano.valor,
      descricao: `Agenda Fashion - Plano ${plano.nome}`,
      formaPagamento: "cartao",
      externalReference: `negocio:${negocio.id};plano:${plano.id}`,
      cartao
    });

  const assinaturaLocal =
    await registrarAssinaturaPendente(client, {
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

async function criarCheckout({
  usuarioId,
  planoId,
  formaPagamento,
  cartao
}) {
  const client = db;

  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  if (!planoId || !["pix", "cartao"].includes(formaPagamento)) {
    throw new Error("Dados de checkout inválidos.");
  }

  if (formaPagamento === "cartao" && !cartao) {
    throw new Error("Dados do cartão não informados.");
  }

  const negocio =
    await checkoutRepository.buscarNegocioDono(
      client,
      usuarioId
    );

  if (!negocio) {
    throw new Error("Negócio não encontrado.");
  }

  if (!negocio.asaas_customer_id) {
    throw new Error("Cliente Asaas não encontrado para este negócio.");
  }

  const plano =
    await checkoutRepository.buscarPlano(
      client,
      planoId
    );

  if (!plano) {
    throw new Error("Plano não encontrado.");
  }

  if (Number(plano.valor || 0) <= 0) {
    throw new Error("Este plano não precisa de pagamento.");
  }

  let resultado = null;

  if (formaPagamento === "pix") {
    resultado = await criarCheckoutPix(
      client,
      negocio,
      plano
    );
  }

  if (formaPagamento === "cartao") {
    resultado = await criarCheckoutCartao(
      client,
      negocio,
      plano,
      cartao
    );
  }

  return {
    mensagem:
      formaPagamento === "pix"
        ? "PIX gerado com sucesso."
        : "Assinatura enviada para processamento.",
    forma_pagamento: formaPagamento,
    ...resultado
  };
}

async function consultarStatusCheckout({
  usuarioId,
  pagamentoId
}) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  if (!pagamentoId) {
    throw new Error("Pagamento não informado.");
  }

  let pagamentoAsaas = null;

  try {
    pagamentoAsaas = await buscarPagamentoAsaas(pagamentoId);
  } catch (erroAsaas) {
    console.error(
      "Erro ao consultar pagamento no Asaas:",
      erroAsaas.response?.data || erroAsaas
    );
  }

  if (
    pagamentoAsaas &&
    ["CONFIRMED", "RECEIVED"].includes(pagamentoAsaas.status)
  ) {
    await ativarAssinaturaPorPagamento(
      pagamentoId,
      pagamentoAsaas.status
    );
  }

  const pagamento =
    await checkoutRepository.buscarPagamentoCheckout(
      pagamentoId,
      usuarioId
    );

  if (!pagamento) {
    throw new Error("Pagamento não encontrado.");
  }

  return pagamento;
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};