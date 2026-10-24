const { dataValida } = require("./assinaturaCalculos");

function assinaturaDto(assinatura) {
  if (!assinatura) return null;
  const fimPago = dataValida(assinatura.acesso_pago_ate === undefined
    ? assinatura.data_proxima_cobranca : assinatura.acesso_pago_ate);
  const semRenovacaoConfirmada = ["CANCELED", "CANCELLED", "REACTIVATING"].includes(assinatura.status);
  const resposta = {
    ...assinatura,
    acesso_pago_ate: fimPago,
    // Compatibilidade de clientes anteriores: cancelado/reativando sempre
    // apresentou o fim pago neste campo. O banco conserva a data do provedor.
    data_proxima_cobranca: semRenovacaoConfirmada ? fimPago : dataValida(assinatura.data_proxima_cobranca),
  };
  delete resposta.reativacao_inicio_cobranca;
  delete resposta.renovacao_chave_versao;
  delete resposta.renovacao_cancelada;
  delete resposta.acesso_pago_reconciliado;
  return resposta;
}

function pagamentoDto(pagamento) {
  if (!pagamento) return null;
  return {
    ...pagamento,
    data_vencimento: dataValida(pagamento.data_vencimento),
    data_pagamento: dataValida(pagamento.data_pagamento),
  };
}

// Normalizar DATE antes de res.json: Date.toJSON() perde o dia civil em
// alguns fusos. TIMESTAMPTZ (created_at, updated_at etc.) continua um instante.
function serializarRespostaAssinatura(resultado) {
  const resposta = { ...resultado };
  if ("assinatura" in resposta) resposta.assinatura = assinaturaDto(resposta.assinatura);
  if ("acesso_ate" in resposta) resposta.acesso_ate = dataValida(resposta.acesso_ate);
  if ("pagamentos" in resposta) resposta.pagamentos = resposta.pagamentos.map(pagamentoDto);
  if (resposta.pagamento_recuperavel) {
    resposta.pagamento_recuperavel = pagamentoDto(resposta.pagamento_recuperavel);
  }
  if (resposta.upgrade_pendente) {
    resposta.upgrade_pendente = {
      ...resposta.upgrade_pendente,
      assinatura: assinaturaDto(resposta.upgrade_pendente.assinatura),
      pagamento: pagamentoDto(resposta.upgrade_pendente.pagamento),
    };
  }
  return resposta;
}

module.exports = { serializarRespostaAssinatura };
