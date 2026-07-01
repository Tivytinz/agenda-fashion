const db = require("../db/db");

const assinaturaRepository = require("../repositories/assinaturaRepository");
const pagamentoRepository = require("../repositories/pagamentoRepository");
const { buscarUsoPlano } = require("./planoService");

async function registrarAssinaturaPendente(client, dados) {
  await assinaturaRepository.desativarAssinaturasDoNegocio(
    client,
    dados.negocio_id
  );

  return assinaturaRepository.criarAssinatura(client, {
    negocio_id: dados.negocio_id,
    plano_id: dados.plano_id,
    asaas_customer_id: dados.asaas_customer_id,
    asaas_subscription_id: dados.asaas_subscription_id || null,
    status: dados.status || "PENDING",
    forma_pagamento: dados.forma_pagamento,
    periodicidade: dados.periodicidade || "MONTHLY",
    valor: dados.valor,
    data_proxima_cobranca: dados.data_proxima_cobranca || null,
    ativo: false,
    observacoes: dados.observacoes || null
  });
}

async function registrarPagamento(client, dados) {
  return pagamentoRepository.criarPagamento(client, {
    assinatura_id: dados.assinatura_id,
    asaas_payment_id: dados.asaas_payment_id,
    valor: dados.valor,
    forma_pagamento: dados.forma_pagamento,
    status: dados.status || "PENDING",
    data_vencimento: dados.data_vencimento || null,
    data_pagamento: dados.data_pagamento || null,
    pix_copia_cola: dados.pix_copia_cola || null,
    pix_qrcode: dados.pix_qrcode || null
  });
}

async function ativarAssinaturaPorPagamento(paymentId, statusPagamento = "CONFIRMED") {
  const pagamento = await pagamentoRepository.buscarPorPaymentId(paymentId);

  if (!pagamento) {
    return null;
  }

  await pagamentoRepository.atualizarStatusPagamento(null, paymentId, {
    status: statusPagamento,
    data_pagamento: new Date()
  });

  const assinatura = await assinaturaRepository.buscarPorId(
    pagamento.assinatura_id
  );

  if (!assinatura) {
    return null;
  }

  await assinaturaRepository.desativarAssinaturasDoNegocio(
    null,
    assinatura.negocio_id
  );

  const assinaturaAtiva =
    await assinaturaRepository.ativarAssinatura(
      null,
      assinatura.id
    );

  await db.query(
    `
    UPDATE negocios
    SET plano_id = $1
    WHERE id = $2
    `,
    [
      assinatura.plano_id,
      assinatura.negocio_id
    ]
  );

  return assinaturaAtiva;
}

async function buscarMinhaAssinatura({ usuarioId }) {
  if (!usuarioId) {
    throw new Error("Usuário não autenticado.");
  }

  const negocio =
    await assinaturaRepository.buscarNegocioDono(usuarioId);

  if (!negocio) {
    throw new Error("Negócio não encontrado.");
  }

  const assinatura =
    await assinaturaRepository.buscarUltimaAssinaturaPorNegocio(
      negocio.id
    );

  const plano =
    await assinaturaRepository.buscarPlano(
      negocio.plano_id
    );

  const pagamentos =
    await assinaturaRepository.listarPagamentos(
      assinatura?.id || 0
    );

  const uso = await buscarUsoPlano(negocio.id);

  return {
    plano,
    assinatura,
    uso: {
      utilizados: uso?.utilizados || 0,
      limite: uso?.capacidade_agendamentos ?? null,
      restantes: uso?.restantes ?? null,
      percentual: uso?.percentual ?? null
    },
    pagamentos
  };
}

module.exports = {
  registrarAssinaturaPendente,
  registrarPagamento,
  ativarAssinaturaPorPagamento,
  buscarMinhaAssinatura
};