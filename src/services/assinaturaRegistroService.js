const assinaturaRepository = require(
  "../repositories/assinaturaRepository"
);
const pagamentoRepository = require(
  "../repositories/pagamentoRepository"
);

async function registrarAssinaturaPendente(client, dados) {
  return assinaturaRepository.criarAssinatura(client, {
    negocio_id: dados.negocio_id,
    plano_id: dados.plano_id,
    asaas_customer_id: dados.asaas_customer_id,
    asaas_subscription_id:
      dados.asaas_subscription_id || null,
    status: dados.status || "PENDING",
    forma_pagamento: dados.forma_pagamento,
    periodicidade: dados.periodicidade || "MONTHLY",
    valor: dados.valor,
    data_proxima_cobranca:
      dados.data_proxima_cobranca || null,
    ativo: false,
    observacoes: dados.observacoes || null,
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
    pix_qrcode: dados.pix_qrcode || null,
  });
}

module.exports = {
  registrarAssinaturaPendente,
  registrarPagamento,
};
