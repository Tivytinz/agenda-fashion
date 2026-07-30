const {
  rateLimit,
  ipKeyGenerator,
} = require(
  "express-rate-limit"
);

function criarLimitador({
  limite,
  janelaMs,
  mensagem,
  chave,
  ignorarEmTeste = true,
  ignorarSucesso = false,
}) {
  return rateLimit({
    windowMs:
      janelaMs,
    limit:
      limite,
    standardHeaders:
      "draft-8",
    legacyHeaders:
      false,
    skipSuccessfulRequests:
      ignorarSucesso,
    skip:
      () =>
        ignorarEmTeste &&
        process.env.NODE_ENV ===
          "test",
    keyGenerator:
      chave,
    handler:
      (_req, res) =>
        res.status(429).json({
          erro:
            mensagem,
        }),
  });
}

function chaveLogin(req) {
  const ip =
    ipKeyGenerator(
      req.ip ||
      req.socket
        ?.remoteAddress ||
      ""
    );

  const email =
    String(
      req.body?.email || ""
    )
      .trim()
      .toLowerCase()
      .slice(0, 160);

  return `${ip}:${email}`;
}

const limitarLogin =
  criarLimitador({
    limite: 10,
    janelaMs:
      15 * 60 * 1000,
    mensagem:
      "Muitas tentativas de login. Aguarde 15 minutos.",
    chave:
      chaveLogin,
    ignorarSucesso:
      true,
  });

const limitarCadastro =
  criarLimitador({
    limite: 5,
    janelaMs:
      60 * 60 * 1000,
    mensagem:
      "Muitos cadastros enviados. Tente novamente mais tarde.",
  });

const limitarAgendamento =
  criarLimitador({
    limite: 30,
    janelaMs:
      15 * 60 * 1000,
    mensagem:
      "Muitos agendamentos enviados. Aguarde alguns minutos.",
  });

const limitarEventos =
  criarLimitador({
    limite: 120,
    janelaMs:
      60 * 1000,
    mensagem:
      "Muitos eventos enviados. Aguarde um minuto.",
  });

const limitarUpload =
  criarLimitador({
    limite: 20,
    janelaMs:
      60 * 60 * 1000,
    mensagem:
      "Muitos uploads enviados. Tente novamente mais tarde.",
  });

module.exports = {
  criarLimitador,
  limitarLogin,
  limitarCadastro,
  limitarAgendamento,
  limitarEventos,
  limitarUpload,
};
