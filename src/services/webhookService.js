const webhookEventoRepository = require(
  "../repositories/webhookEventoRepository"
);

const {
  ativarAssinaturaPorPagamento
} = require("./assinaturaService");

const EVENTOS_PAGAMENTO_CONFIRMADO =
  new Set([
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED"
  ]);

function dadosLog(evento) {
  return {
    registro_id: evento?.id || null,
    evento_id: evento?.evento_id || null,
    tipo_evento: evento?.tipo_evento || null,
    pagamento_id:
      evento?.recurso_id || null,
    tentativa:
      evento?.tentativas || null
  };
}

async function enfileirarWebhookAsaas({
  eventoId,
  tipoEvento,
  pagamento
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
            pagamento.externalReference || null
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
          pagamento?.id || null,
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
    console.error(
      "[Webhook Asaas] Falha ao registrar erro do evento.",
      {
        registro_id: evento.id,
        erro: erroRegistro?.message
      }
    );
  }
}

async function processarRegistro(evento) {
  const contexto = dadosLog(evento);
  const pagamento =
    evento.payload?.payment || null;
  const pagamentoId =
    pagamento?.id ||
    evento.recurso_id ||
    null;

  try {
    if (
      !EVENTOS_PAGAMENTO_CONFIRMADO
        .has(evento.tipo_evento)
    ) {
      await webhookEventoRepository
        .marcarConcluido(
          evento.id,
          "IGNORED"
        );

      console.info(
        "[Webhook Asaas] Evento ignorado.",
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

    const assinatura =
      await ativarAssinaturaPorPagamento(
        pagamentoId,
        pagamento?.status ||
        "CONFIRMED"
      );

    if (!assinatura) {
      const erro = new Error(
        "Pagamento do webhook não encontrado."
      );

      erro.code =
        "WEBHOOK_PAYMENT_NOT_FOUND";

      throw erro;
    }

    await webhookEventoRepository
      .marcarConcluido(
        evento.id,
        "PROCESSED"
      );

    console.info(
      "[Webhook Asaas] Evento processado.",
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

    console.error(
      "[Webhook Asaas] Falha no processamento.",
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
  const executar = () => {
    processarFilaWebhook()
      .catch((erro) => {
        console.error(
          "[Webhook Asaas] Falha no worker.",
          {
            erro: erro?.message
          }
        );
      });
  };

  setImmediate(executar);

  const intervalo =
    setInterval(
      executar,
      30000
    );

  intervalo.unref?.();

  return intervalo;
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
  processarWebhookAsaas
};
