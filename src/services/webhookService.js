const webhookEventoRepository = require(
  "../repositories/webhookEventoRepository"
);

const {
  ativarAssinaturaPorPagamento,
} = require("./assinaturaService");

const EVENTOS_PAGAMENTO_CONFIRMADO =
  new Set([
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
  ]);

function dadosLog(
  registro,
  {
    eventoId,
    tipoEvento,
    pagamentoId,
  }
) {
  return {
    registro_id:
      registro?.evento?.id || null,
    evento_id: eventoId,
    tipo_evento: tipoEvento,
    pagamento_id:
      pagamentoId || null,
    tentativa:
      registro?.evento
        ?.tentativas || null,
  };
}

async function registrarFalha(
  registroId,
  erro
) {
  try {
    await webhookEventoRepository
      .marcarFalha(
        registroId,
        erro?.message ||
        "Falha desconhecida."
      );
  } catch (erroRegistro) {
    console.error(
      "[Webhook Asaas] Falha ao registrar erro do evento.",
      {
        registro_id:
          registroId,
        erro:
          erroRegistro?.message,
      }
    );
  }
}

async function processarWebhookAsaas({
  eventoId,
  tipoEvento,
  pagamento,
}) {
  const pagamentoId =
    pagamento?.id || null;

  const registro =
    await webhookEventoRepository
      .registrarRecebimento({
        provedor: "asaas",
        eventoId,
        tipoEvento,
        recursoId:
          pagamentoId,
      });

  const contexto = dadosLog(
    registro,
    {
      eventoId,
      tipoEvento,
      pagamentoId,
    }
  );

  if (!registro.processar) {
    const emProcessamento =
      registro.evento?.status ===
      "PROCESSING";

    console.info(
      "[Webhook Asaas] Evento duplicado.",
      contexto
    );

    return {
      duplicado: true,
      ignorado: false,
      em_processamento:
        emProcessamento,
      status:
        registro.evento?.status ||
        null,
    };
  }

  try {
    if (
      !EVENTOS_PAGAMENTO_CONFIRMADO
        .has(tipoEvento)
    ) {
      await webhookEventoRepository
        .marcarConcluido(
          registro.evento.id,
          "IGNORED"
        );

      console.info(
        "[Webhook Asaas] Evento ignorado.",
        contexto
      );

      return {
        duplicado: false,
        ignorado: true,
        em_processamento: false,
        status: "IGNORED",
      };
    }

    if (!pagamentoId) {
      const erro =
        new Error(
          "Pagamento não informado no webhook."
        );

      erro.code =
        "WEBHOOK_PAYMENT_REQUIRED";

      throw erro;
    }

    const assinatura =
      await ativarAssinaturaPorPagamento(
        pagamentoId,
        pagamento.status ||
        "CONFIRMED"
      );

    if (!assinatura) {
      const erro =
        new Error(
          "Pagamento do webhook não encontrado."
        );

      erro.code =
        "WEBHOOK_PAYMENT_NOT_FOUND";

      throw erro;
    }

    await webhookEventoRepository
      .marcarConcluido(
        registro.evento.id,
        "PROCESSED"
      );

    console.info(
      "[Webhook Asaas] Evento processado.",
      contexto
    );

    return {
      duplicado: false,
      ignorado: false,
      em_processamento: false,
      status: "PROCESSED",
    };
  } catch (erro) {
    await registrarFalha(
      registro.evento.id,
      erro
    );

    console.error(
      "[Webhook Asaas] Falha no processamento.",
      {
        ...contexto,
        codigo:
          erro?.code || null,
        erro:
          erro?.message,
      }
    );

    throw erro;
  }
}

module.exports = {
  processarWebhookAsaas,
};
