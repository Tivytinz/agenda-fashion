const crypto = require("crypto");
const {
  buscarPagamentoAsaas,
  listarEstornosPagamentoAsaas,
} = require("./asaasService");
const repository = require(
  "../repositories/paymentEconomicsRepository"
);

const STATUS_CHARGEBACK = new Set([
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
]);

function numeroOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const convertido = Number(valor);
  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function dataHoraAsaas(valor) {
  const texto = String(valor || "")
    .trim();

  if (
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/
      .test(texto)
  ) {
    return texto
      .replace("T", " ")
      .slice(0, 19);
  }

  return null;
}

function dataAsaas(valor) {
  const texto = String(valor || "")
    .trim();

  return /^\d{4}-\d{2}-\d{2}$/
    .test(texto)
    ? texto
    : null;
}

function statusEstorno(valor) {
  const status = String(valor || "")
    .trim()
    .toUpperCase();

  return [
    "PENDING",
    "CANCELLED",
    "DONE",
  ].includes(status)
    ? status
    : "UNKNOWN";
}

function chaveEstorno(estorno, indice) {
  const base = [
    String(estorno?.dateCreated || ""),
    Number(estorno?.value || 0)
      .toFixed(2),
    String(estorno?.description || ""),
    String(indice),
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(base)
    .digest("hex");
}

function normalizarEstornos(lista = []) {
  return (
    Array.isArray(lista)
      ? lista
      : []
  ).map((estorno, indice) => ({
    chaveProvedor:
      chaveEstorno(estorno, indice),
    valor:
      Math.max(
        0,
        numeroOuNull(estorno?.value) || 0
      ),
    status:
      statusEstorno(estorno?.status),
    ocorridoEm:
      dataHoraAsaas(
        estorno?.dateCreated
      ),
  }));
}

function proximaReconciliacao(
  statusReconciliacao
) {
  if (statusReconciliacao === "COMPLETO") {
    return null;
  }

  const horas =
    statusReconciliacao ===
      "REFUND_EM_PROCESSAMENTO"
      ? 1
      : 6;

  return new Date(
    Date.now() +
      horas * 60 * 60 * 1000
  ).toISOString();
}

function classificarEconomia({
  pagamento,
  estornos,
}) {
  const statusPagamento = String(
    pagamento?.status || ""
  )
    .trim()
    .toUpperCase();
  const valorBruto =
    numeroOuNull(pagamento?.value);
  const valorLiquidoGateway =
    numeroOuNull(pagamento?.netValue);
  const temEstornoPendente =
    estornos.some(
      (item) =>
        item.status === "PENDING" ||
        item.status === "UNKNOWN"
    );

  let statusReconciliacao =
    "DADOS_GATEWAY_INCOMPLETOS";

  if (
    STATUS_CHARGEBACK
      .has(statusPagamento)
  ) {
    statusReconciliacao =
      "CHARGEBACK_EM_DISPUTA";
  } else if (
    statusPagamento ===
      "REFUND_IN_PROGRESS" ||
    temEstornoPendente
  ) {
    statusReconciliacao =
      "REFUND_EM_PROCESSAMENTO";
  } else if (
    statusPagamento ===
      "RECEIVED_IN_CASH_UNDONE"
  ) {
    statusReconciliacao =
      "REVERSAO_NAO_RECONCILIADA";
  } else if (
    valorLiquidoGateway === null ||
    valorBruto === null
  ) {
    statusReconciliacao =
      "DADOS_GATEWAY_INCOMPLETOS";
  } else if (
    statusPagamento === "CONFIRMED"
  ) {
    statusReconciliacao =
      "AGUARDANDO_LIQUIDACAO";
  } else if (
    [
      "RECEIVED",
      "RECEIVED_IN_CASH",
      "REFUNDED",
      "PARTIALLY_REFUNDED",
      "REFUND_DENIED",
    ].includes(statusPagamento)
  ) {
    statusReconciliacao =
      "COMPLETO";
  }

  return {
    valorBruto:
      Math.max(0, valorBruto || 0),
    valorLiquidoGateway:
      valorLiquidoGateway === null
        ? null
        : Math.max(
            0,
            valorLiquidoGateway
          ),
    dataCredito:
      dataAsaas(
        pagamento?.creditDate
      ),
    statusPagamento:
      statusPagamento || "UNKNOWN",
    statusReconciliacao,
    proximaReconciliacaoEm:
      proximaReconciliacao(
        statusReconciliacao
      ),
  };
}

async function buscarEstornos(
  pagamento
) {
  if (
    Array.isArray(pagamento?.refunds)
  ) {
    return pagamento.refunds;
  }

  const status = String(
    pagamento?.status || ""
  )
    .trim()
    .toUpperCase();

  if (
    !status.includes("REFUND") &&
    status !== "PARTIALLY_REFUNDED"
  ) {
    return [];
  }

  return listarEstornosPagamentoAsaas(
    pagamento.id
  );
}

async function reconciliarPagamento(
  candidato
) {
  const paymentId = String(
    candidato?.asaas_payment_id || ""
  ).trim();

  if (!paymentId) {
    return null;
  }

  const pagamento =
    await buscarPagamentoAsaas(
      paymentId
    );
  const estornosBrutos =
    await buscarEstornos(
      pagamento
    );
  const estornos =
    normalizarEstornos(
      estornosBrutos
    );
  const economia =
    classificarEconomia({
      pagamento,
      estornos,
    });

  return repository
    .persistirReconciliacao({
      pagamentoId:
        candidato.pagamento_id,
      eventoEsperadoEm:
        candidato.asaas_ultimo_evento_em ||
        null,
      eventoEsperadoId:
        candidato.asaas_ultimo_evento_id ||
        null,
      economia,
      estornos,
    });
}

module.exports = {
  reconciliarPagamento,
  classificarEconomia,
  normalizarEstornos,
};
