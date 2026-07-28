const {
  enfileirarWebhookAsaas,
  agendarProcessamentoWebhook,
} = require("../services/webhookService");

async function receberWebhookAsaas(req, res, next) {
  try {
    const eventoId = req.body?.id;
    const tipoEvento = req.body?.event;

    if (!eventoId || !tipoEvento) {
      return res.status(400).json({
        erro: "Webhook inválido.",
      });
    }

    const resultado =
      await enfileirarWebhookAsaas({
        eventoId,
        tipoEvento,
        pagamento:
          req.body?.payment || null,
      });

    if (resultado.evento?.id) {
      agendarProcessamentoWebhook(
        resultado.evento.id
      );
    }

    return res.json({
      recebido: true,
      duplicado:
        resultado.duplicado,
      enfileirado: true,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  receberWebhookAsaas,
};
