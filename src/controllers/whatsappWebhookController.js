const crypto = require("crypto");

const {
  processarWebhookWhatsapp,
} = require(
  "../services/whatsappWebhookService"
);

function valoresIguais(
  recebido,
  esperado
) {
  const primeiro =
    Buffer.from(
      String(recebido || "")
    );

  const segundo =
    Buffer.from(
      String(esperado || "")
    );

  return (
    primeiro.length ===
      segundo.length &&
    crypto.timingSafeEqual(
      primeiro,
      segundo
    )
  );
}

function verificarWebhook(
  req,
  res
) {
  const modo =
    req.query[
      "hub.mode"
    ];

  const token =
    req.query[
      "hub.verify_token"
    ];

  const desafio =
    req.query[
      "hub.challenge"
    ];

  const tokenEsperado =
    process.env
      .WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (
    modo === "subscribe" &&
    tokenEsperado &&
    valoresIguais(
      token,
      tokenEsperado
    )
  ) {
    return res
      .status(200)
      .type("text/plain")
      .send(
        String(desafio || "")
      );
  }

  return res.sendStatus(403);
}

async function receberStatus(
  req,
  res,
  next
) {
  try {
    const resultado =
      await processarWebhookWhatsapp(
        req.body
      );

    return res.status(200).json({
      recebido: true,
      ...resultado,
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  verificarWebhook,
  receberStatus,
};
