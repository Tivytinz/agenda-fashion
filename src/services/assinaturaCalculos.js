function calcularProximaCobranca(dataBase = new Date()) {
  if (dataBase === null || (typeof dataBase === "string" && !dataBase.trim())) {
    throw new Error("Não foi possível calcular a próxima cobrança da assinatura.");
  }
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
  const acessoAte = dataValida(assinatura?.acesso_pago_ate ?? assinatura?.data_proxima_cobranca);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    assinatura?.ativo === true &&
    acessoAte !== null &&
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
  let texto;
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    // DATE no pg é meia-noite no fuso do processo. Os campos locais preservam
    // o dia civil do banco; converter esse Date para UTC pode mudar a data.
    if (!Number.isFinite(Date.prototype.getTime.call(valor))) return null;
    texto = [
      String(Date.prototype.getFullYear.call(valor)).padStart(4, "0"),
      String(Date.prototype.getMonth.call(valor) + 1).padStart(2, "0"),
      String(Date.prototype.getDate.call(valor)).padStart(2, "0"),
    ].join("-");
  } else if (typeof valor === "string") {
    texto = valor.trim().slice(0, 10);
  } else return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || texto.startsWith("0000-")) return null;
  const data = new Date(`${texto}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === texto
    ? texto : null;
}

module.exports = {
  calcularProximaCobranca,
  normalizarFormaPagamento,
  extrairReferenciaAssinatura,
  acessoPagoAindaValido,
  criarErro,
  dataValida,
};
