const webhookEventoRepository = require(
  "../repositories/webhookEventoRepository"
);
const registrador = require("../utils/registrador");

const {
  ativarAssinaturaPorPagamento,
  sincronizarAssinaturaPorWebhook,
  sincronizarPagamentoPorWebhook,
  suspenderAssinaturaPorPagamento
} = require("./assinaturaService");

const EVENTOS_PAGAMENTO_CONFIRMADO =
  new Set([
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED"
  ]);

const EVENTOS_SINCRONIZACAO =
  new Set([
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "PAYMENT_RESTORED",
    "PAYMENT_REFUNDED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "PAYMENT_REFUND_IN_PROGRESS",
    "PAYMENT_REFUND_DENIED",
    "PAYMENT_RECEIVED_IN_CASH_UNDONE",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "PAYMENT_CHARGEBACK_REQUESTED",
    "PAYMENT_CHARGEBACK_DISPUTE",
    "PAYMENT_AWAITING_CHARGEBACK_REVERSAL"
  ]);

const EVENTOS_SUSPENSAO =
  new Set([
    "PAYMENT_OVERDUE",
    "PAYMENT_REFUNDED",
    "PAYMENT_RECEIVED_IN_CASH_UNDONE",
    "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
    "PAYMENT_CHARGEBACK_REQUESTED"
  ]);

const EVENTOS_ASSINATURA =
  new Set([
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "SUBSCRIPTION_INACTIVATED",
    "SUBSCRIPTION_DELETED"
  ]);

let temporizadorWorker =
  null;

function normalizarPagamentoPorEvento(
  tipoEvento,
  pagamento
) {
  const pagamentoNormalizado = {
    ...(pagamento || {})
  };

  if (tipoEvento === "PAYMENT_DELETED") {
    pagamentoNormalizado.status =
      "DELETED";
  }

  return pagamentoNormalizado;
}

function dadosLog(evento) {
  return {
    registro_id: evento?.id || null,
    evento_id: evento?.evento_id || null,
    tipo_evento: evento?.tipo_evento || null,
    recurso_id:
      evento?.recurso_id || null,
    tentativa:
      evento?.tentativas || null
  };
}

async function enfileirarWebhookAsaas({
  eventoId,
  tipoEvento,
  pagamento,
  assinatura
}) {
  const payloadSeguro = {
    id: eventoId,
    event: tipoEvento,
    payment: pagamento
      ? {
          id: pagamento.id || null,
          status:
            pagamento.status || null,
          subscription:
            pagamento.subscription || null,
          externalReference:
            pagamento.externalReference || null,
          value:
            pagamento.value ?? null,
          billingType:
            pagamento.billingType || null,
          dueDate:
            pagamento.dueDate || null,
          paymentDate:
            pagamento.paymentDate || null,
          confirmedDate:
            pagamento.confirmedDate || null
        }
      : null,
    subscription: assinatura
      ? {
          id: assinatura.id || null,
          status:
            assinatura.status || null,
          customer:
            assinatura.customer || null,
          value:
            assinatura.value ?? null,
          nextDueDate:
            assinatura.nextDueDate || null,
          cycle:
            assinatura.cycle || null,
          billingType:
            assinatura.billingType || null,
          externalReference:
            assinatura.externalReference || null,
          deleted:
            assinatura.deleted ?? null
        }
      : null
  };

  const registro =
    await webhookEventoRepository
      .registrarRecebimento({
        provedor: "asaas",
        eventoId,
        tipoEvento,
        recursoId:
          pagamento?.id ||
          assinatura?.id ||
          null,
        payload: payloadSeguro
      });

  return {
    duplicado: !registro.novo,
    evento: registro.evento
  };
}

async function registrarFalha(evento, erro) {
  try {
    await webhookEventoRepository
      .marcarFalha(
        evento.id,
        erro?.message ||
        "Falha desconhecida."
      );
  } catch (erroRegistro) {
    registrador.erro(
      "Webhook Asaas: falha ao registrar o erro do evento.",
      {
        registro_id: evento.id,
        erro: erroRegistro?.message
      }
    );
  }
}

async function processarRegistro(evento) {
  const contexto = dadosLog(evento);
  const assinatura =
    evento.payload?.subscription || null;
  const pagamento =
    normalizarPagamentoPorEvento(
      evento.tipo_evento,
      evento.payload?.payment || null
    );
  const pagamentoId =
    pagamento?.id ||
    evento.recurso_id ||
    null;

  try {
    if (
      EVENTOS_ASSINATURA
        .has(evento.tipo_evento)
    ) {
      const assinaturaId =
        assinatura?.id ||
        evento.recurso_id ||
        null;

      if (!assinaturaId) {
        const erro = new Error(
          "Assinatura não informada no webhook."
        );

        erro.code =
          "WEBHOOK_SUBSCRIPTION_REQUIRED";

        throw erro;
      }

      const resultado =
        await sincronizarAssinaturaPorWebhook(
          evento.tipo_evento,
          {
            ...(assinatura || {}),
            id: assinaturaId
          }
        );

      if (!resultado) {
        await webhookEventoRepository
          .marcarConcluido(
            evento.id,
            "IGNORED"
          );

        registrador.informacao(
          "Webhook Asaas: assinatura sem vínculo local ignorada.",
          contexto
        );

        return {
          ignorado: true,
          status: "IGNORED"
        };
      }

      await webhookEventoRepository
        .marcarConcluido(
          evento.id,
          "PROCESSED"
        );

      registrador.informacao(
        "Webhook Asaas: evento de assinatura processado.",
        contexto
      );

      return {
        ignorado: false,
        status: "PROCESSED"
      };
    }

    if (
      !EVENTOS_PAGAMENTO_CONFIRMADO
        .has(evento.tipo_evento) &&
      !EVENTOS_SINCRONIZACAO
        .has(evento.tipo_evento)
    ) {
      await webhookEventoRepository
        .marcarConcluido(
          evento.id,
          "IGNORED"
        );

      registrador.informacao(
        "Webhook Asaas: evento ignorado.",
        contexto
      );

      return {
        ignorado: true,
        status: "IGNORED"
      };
    }

    if (!pagamentoId) {
      const erro = new Error(
        "Pagamento não informado no webhook."
      );

      erro.code =
        "WEBHOOK_PAYMENT_REQUIRED";

      throw erro;
    }

    let resultado = null;

    if (
      EVENTOS_PAGAMENTO_CONFIRMADO
        .has(evento.tipo_evento)
    ) {
      resultado =
        await ativarAssinaturaPorPagamento(
          pagamentoId,
          pagamento?.status ||
          "CONFIRMED",
          pagamento || {}
        );
    } else if (
      EVENTOS_SUSPENSAO
        .has(evento.tipo_evento)
    ) {
      resultado =
        await suspenderAssinaturaPorPagamento(
          {
            ...(pagamento || {}),
            id: pagamentoId
          }
        );
    } else {
      resultado =
        await sincronizarPagamentoPorWebhook(
          {
            ...(pagamento || {}),
            id: pagamentoId
          }
        );
    }

    if (!resultado) {
      await webhookEventoRepository
        .marcarConcluido(
          evento.id,
          "IGNORED"
        );

      registrador.informacao(
        "Webhook Asaas: pagamento sem vínculo local ignorado.",
        contexto
      );

      return {
        ignorado: true,
        status: "IGNORED"
      };
    }

    await webhookEventoRepository
      .marcarConcluido(
        evento.id,
        "PROCESSED"
      );

    registrador.informacao(
      "Webhook Asaas: evento processado.",
      contexto
    );

    return {
      ignorado: false,
      status: "PROCESSED"
    };
  } catch (erro) {
    await registrarFalha(
      evento,
      erro
    );

    registrador.erro(
      "Webhook Asaas: falha no processamento.",
      {
        ...contexto,
        codigo: erro?.code || null,
        erro: erro?.message
      }
    );

    throw erro;
  }
}

async function processarEventoWebhook(eventoId) {
  const evento =
    await webhookEventoRepository
      .reservarPorId(eventoId);

  if (!evento) {
    return {
      processado: false,
      indisponivel: true
    };
  }

  return processarRegistro(evento);
}

function agendarProcessamentoWebhook(eventoId) {
  setImmediate(() => {
    processarEventoWebhook(eventoId)
      .catch(() => {});
  });
}

async function processarFilaWebhook(limite = 20) {
  let processados = 0;

  while (processados < limite) {
    const evento =
      await webhookEventoRepository
        .reservarProximo();

    if (!evento) {
      break;
    }

    await processarRegistro(evento)
      .catch(() => {});

    processados += 1;
  }

  return processados;
}

function iniciarWorkerWebhook() {
  if (temporizadorWorker) {
    return temporizadorWorker;
  }

  const executar = () => {
    processarFilaWebhook()
      .catch((erro) => {
        registrador.erro(
          "Webhook Asaas: falha no processador da fila.",
          {
            erro: erro?.message
          }
        );
      });
  };

  setImmediate(executar);

  temporizadorWorker =
    setInterval(
      executar,
      30000
    );

  temporizadorWorker
    .unref?.();

  return temporizadorWorker;
}

function pararWorkerWebhook() {
  if (!temporizadorWorker) {
    return;
  }

  clearInterval(
    temporizadorWorker
  );

  temporizadorWorker =
    null;
}

async function processarWebhookAsaas(dados) {
  const registro =
    await enfileirarWebhookAsaas(dados);

  const resultado =
    await processarEventoWebhook(
      registro.evento.id
    );

  return {
    duplicado: registro.duplicado,
    ...resultado
  };
}

module.exports = {
  enfileirarWebhookAsaas,
  processarEventoWebhook,
  agendarProcessamentoWebhook,
  processarFilaWebhook,
  iniciarWorkerWebhook,
  pararWorkerWebhook,
  processarWebhookAsaas
};
