const crypto = require("crypto");

function texto(valor) {
  return String(valor || "").trim();
}

function exigirSegredo(valor, nome) {
  const segredo = texto(valor);

  if (!segredo) {
    throw new Error(
      `${nome} não configurado nas variáveis de ambiente.`
    );
  }

  if (segredo.length < 32) {
    throw new Error(
      `${nome} precisa ter pelo menos 32 caracteres.`
    );
  }

  return segredo;
}

function obterSegredoAtual(env = process.env) {
  const dedicado = texto(
    env.BOOKING_CAPABILITY_SECRET
  );

  if (dedicado) {
    return exigirSegredo(
      dedicado,
      "BOOKING_CAPABILITY_SECRET"
    );
  }

  return exigirSegredo(
    env.JWT_SECRET,
    "JWT_SECRET"
  );
}

function obterSegredosValidacao(
  env = process.env
) {
  const dedicado = texto(
    env.BOOKING_CAPABILITY_SECRET
  );

  /*
   * Depois que o segredo dedicado existe, JWT_SECRET deixa de ser
   * aceito automaticamente. Links históricos só permanecem válidos
   * quando o segredo anterior é informado explicitamente.
   */
  if (dedicado) {
    const segredos = [
      exigirSegredo(
        dedicado,
        "BOOKING_CAPABILITY_SECRET"
      ),
    ];

    const anterior = texto(
      env.BOOKING_CAPABILITY_PREVIOUS_SECRET
    );

    if (anterior) {
      const validado =
        exigirSegredo(
          anterior,
          "BOOKING_CAPABILITY_PREVIOUS_SECRET"
        );

      if (!segredos.includes(validado)) {
        segredos.push(validado);
      }
    }

    return segredos;
  }

  return [
    exigirSegredo(
      env.JWT_SECRET,
      "JWT_SECRET"
    ),
  ];
}

function assinarCapability({
  contexto,
  payload,
  env = process.env,
}) {
  return crypto
    .createHmac(
      "sha256",
      obterSegredoAtual(env)
    )
    .update(
      `${contexto}:${payload}`
    )
    .digest("base64url");
}

function assinaturaCorresponde({
  contexto,
  payload,
  assinatura,
  env = process.env,
}) {
  if (
    typeof assinatura !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(
      assinatura
    )
  ) {
    return false;
  }

  const recebido = Buffer.from(
    assinatura,
    "utf8"
  );

  let segredos;

  try {
    segredos =
      obterSegredosValidacao(env);
  } catch {
    return false;
  }

  return segredos.some(
    (segredo) => {
      const esperado =
        crypto
          .createHmac(
            "sha256",
            segredo
          )
          .update(
            `${contexto}:${payload}`
          )
          .digest(
            "base64url"
          );

      const esperadoBuffer =
        Buffer.from(
          esperado,
          "utf8"
        );

      return (
        recebido.length ===
          esperadoBuffer.length &&
        crypto.timingSafeEqual(
          recebido,
          esperadoBuffer
        )
      );
    }
  );
}

module.exports = {
  assinarCapability,
  assinaturaCorresponde,
  obterSegredoAtual,
  obterSegredosValidacao,
};
