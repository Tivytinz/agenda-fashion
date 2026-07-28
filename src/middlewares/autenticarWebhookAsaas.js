const crypto = require("crypto");

const UnauthorizedError = require(
  "../errors/UnauthorizedError"
);

function tokensIguais(
  tokenRecebido,
  tokenEsperado
) {
  const recebido = Buffer.from(
    String(tokenRecebido || "")
  );

  const esperado = Buffer.from(
    String(tokenEsperado || "")
  );

  if (
    recebido.length === 0 ||
    recebido.length !== esperado.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    recebido,
    esperado
  );
}

function autenticarWebhookAsaas(
  req,
  res,
  next
) {
  const tokenEsperado = String(
    process.env.ASAAS_WEBHOOK_TOKEN ||
    ""
  ).trim();

  if (
    tokenEsperado.length < 32
  ) {
    console.error(
      "[Webhook Asaas] ASAAS_WEBHOOK_TOKEN ausente ou inseguro."
    );

    return res.status(503).json({
      erro:
        "Webhook temporariamente indisponível.",
    });
  }

  const tokenRecebido =
    req.get("asaas-access-token");

  if (
    !tokensIguais(
      tokenRecebido,
      tokenEsperado
    )
  ) {
    return next(
      new UnauthorizedError(
        "Token do webhook inválido."
      )
    );
  }

  return next();
}

module.exports =
  autenticarWebhookAsaas;
