const assinaturaRepository = require("../repositories/assinaturaRepository");
const { calcularProximaCobranca, criarErro, dataValida } = require("./assinaturaCalculos");

async function calcularFimDoPeriodoPago(assinatura, executor, { reconciliar = false, permitirAusente = false } = {}) {
  // A janela de 12 itens é de apresentação; a evidência de acesso usa todo o histórico.
  const pagamentos = await assinaturaRepository.listarPagamentos(assinatura.id, executor, null);
  const usarLegado = !reconciliar && assinatura.acesso_pago_reconciliado !== true;
  const periodos = usarLegado ? [dataValida(assinatura.acesso_pago_ate ??
    (assinatura.ativo === true ? assinatura.data_proxima_cobranca : null))] : [];
  for (const pagamento of pagamentos) {
    if (!["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(
      String(pagamento?.status || "").trim().toUpperCase()
    )) continue;
    const dia = dataValida(pagamento.data_pagamento) || dataValida(pagamento.data_vencimento);
    if (dia) periodos.push(calcularProximaCobranca(dia));
  }
  const fim = periodos.filter(Boolean).sort().at(-1);
  if (fim) return fim;
  if (permitirAusente) return null;
  throw criarErro("Não foi possível identificar até quando o plano já está pago.", 409);
}

module.exports = { calcularFimDoPeriodoPago };
