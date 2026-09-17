function calcularProximaCobranca(dataBase = new Date()) {
  const data = new Date(dataBase);

  if (Number.isNaN(data.getTime())) {
    throw new Error(
      "Não foi possível calcular a próxima cobrança da assinatura."
    );
  }

  const ano = data.getUTCFullYear();
  const mesSeguinte = data.getUTCMonth() + 1;
  const diaAtual = data.getUTCDate();
  const ultimoDiaDoMesSeguinte = new Date(
    Date.UTC(ano, mesSeguinte + 1, 0)
  ).getUTCDate();
  const proximaCobranca = new Date(
    Date.UTC(
      ano,
      mesSeguinte,
      Math.min(diaAtual, ultimoDiaDoMesSeguinte)
    )
  );

  return proximaCobranca.toISOString().slice(0, 10);
}

function normalizarFormaPagamento(billingType) {
  const tipo = String(billingType || "")
    .trim()
    .toUpperCase();

  return {
    PIX: "pix",
    CREDIT_CARD: "cartao",
    BOLETO: "boleto",
  }[tipo] || null;
}

function extrairReferenciaAssinatura(externalReference) {
  const valores = {};

  for (const trecho of String(externalReference || "").split(";")) {
    const [chave, valor] = trecho.split(":");

    if (
      ["assinatura", "negocio", "plano"].includes(chave) &&
      /^\d+$/.test(valor || "")
    ) {
      valores[chave] = Number(valor);
    }
  }

  return valores;
}

function acessoPagoAindaValido(assinatura) {
  const acessoAte = String(
    assinatura?.data_proxima_cobranca || ""
  ).slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    assinatura?.ativo === true &&
    /^\d{4}-\d{2}-\d{2}$/.test(acessoAte) &&
    acessoAte > hoje
  );
}

function criarErro(mensagem, status = 400) {
  const erro = new Error(mensagem);
  erro.status = status;
  erro.statusCode = status;
  return erro;
}

function dataValida(valor) {
  const texto = String(valor || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? texto
    : null;
}

module.exports = {
  calcularProximaCobranca,
  normalizarFormaPagamento,
  extrairReferenciaAssinatura,
  acessoPagoAindaValido,
  criarErro,
  dataValida,
};
