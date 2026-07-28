const {
  processarWebhookAsaas,
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
      await processarWebhookAsaas({
        eventoId,
        tipoEvento,
        pagamento:
          req.body?.payment || null,
      });

    if (resultado.em_processamento) {
      res.set("Retry-After", "5");

      return res.status(503).json({
        recebido: false,
        tentar_novamente: true,
      });
    }

    return res.json({
      recebido: true,
      duplicado:
        resultado.duplicado,
      ignorado:
        resultado.ignorado,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  receberWebhookAsaas,
};
