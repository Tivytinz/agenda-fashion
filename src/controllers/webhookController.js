const {
  ativarAssinaturaPorPagamento
} = require("../services/assinaturaService");

async function receberWebhookAsaas(req, res) {
  try {
    const evento = req.body?.event;
    const pagamento = req.body?.payment;

    console.log("Webhook Asaas recebido:", evento);

    if (!evento || !pagamento?.id) {
      return res.status(400).json({
        erro: "Webhook inválido."
      });
    }

    if (
      evento === "PAYMENT_CONFIRMED" ||
      evento === "PAYMENT_RECEIVED"
    ) {
      await ativarAssinaturaPorPagamento(
        pagamento.id,
        pagamento.status || "CONFIRMED"
      );
    }

    return res.json({
      recebido: true
    });

  } catch (err) {
    console.error("Erro no webhook Asaas:", err);

    return res.status(500).json({
      erro: "Erro ao processar webhook."
    });
  }
}

module.exports = {
  receberWebhookAsaas
};