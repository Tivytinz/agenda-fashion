const crypto = require("crypto");
const registrador = require("../utils/registrador");

function compararAssinaturas(
  recebida,
  esperada
) {
  const bufferRecebido =
    Buffer.from(
      String(recebida || "")
    );

  const bufferEsperado =
    Buffer.from(esperada);

  return (
    bufferRecebido.length ===
      bufferEsperado.length &&
    crypto.timingSafeEqual(
      bufferRecebido,
      bufferEsperado
    )
  );
}

function autenticarWebhookWhatsapp(
  req,
  res,
  next
) {
  const segredo =
    String(
      process.env
        .WHATSAPP_APP_SECRET ||
      ""
    ).trim();

  if (!segredo) {
    registrador.erro(
      "Webhook WhatsApp: WHATSAPP_APP_SECRET não configurado."
    );

    return res.status(503).json({
      erro:
        "Webhook indisponível.",
    });
  }

  if (
    !Buffer.isBuffer(
      req.rawBody
    )
  ) {
    return res.status(400).json({
      erro:
        "Corpo original não disponível.",
    });
  }

  const assinaturaEsperada =
    `sha256=${
      crypto
        .createHmac(
          "sha256",
          segredo
        )
        .update(req.rawBody)
        .digest("hex")
    }`;

  const assinaturaRecebida =
    req.get(
      "X-Hub-Signature-256"
    );

  if (
    !compararAssinaturas(
      assinaturaRecebida,
      assinaturaEsperada
    )
  ) {
    return res.status(401).json({
      erro:
        "Assinatura inválida.",
    });
  }

  return next();
}

module.exports =
  autenticarWebhookWhatsapp;
