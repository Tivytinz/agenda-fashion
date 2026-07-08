const {
  ativarAssinaturaPorPagamento,
} = require("../services/assinaturaService");

async function receberWebhookAsaas(req, res, next) {
  try {
    const evento = req.body?.event;
    const pagamento = req.body?.payment;

    if (!evento || !pagamento?.id) {
      return res.status(400).json({
        erro: "Webhook inválido.",
      });
    }

    switch (evento) {
      case "PAYMENT_CONFIRMED":
      case "PAYMENT_RECEIVED":
        await ativarAssinaturaPorPagamento(
          pagamento.id,
          pagamento.status || "CONFIRMED"
        );
        break;

      default:
        // Outros eventos são ignorados
        break;
    }

    return res.json({
      recebido: true,
    });

  } catch (err) {
    next(err);
  }
}

module.exports = {
  receberWebhookAsaas,
};