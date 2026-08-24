const contaService = require(
  "../services/contaService"
);

/*
 * GET /conta
 */
async function buscarMinhaConta(
  req,
  res,
  next
) {
  try {
    const resultado =
      await contaService
        .buscarMinhaConta({
          usuarioId:
            req.user?.id,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

/*
 * PUT /conta
 */
async function atualizarMinhaConta(
  req,
  res,
  next
) {
  try {
    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const resultado =
      await contaService
        .atualizarMinhaConta({
          usuarioId:
            req.user?.id,

          nome:
            body.nome,

          whatsapp:
            body.whatsapp,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarPreferenciaWhatsapp(
  req,
  res,
  next
) {
  try {
    const resultado =
      await contaService
        .atualizarPreferenciaWhatsapp({
          usuarioId:
            req.user?.id,
          aceitaAlertasOperacionais:
            req.body?.aceitaAlertasOperacionais,
          aceitaLembretes:
            req.body?.aceitaLembretes,
          origem:
            req.body?.origem === "painel"
              ? "PAINEL"
              : "MINHA_CONTA",
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarNotificacoesWhatsapp(
  req,
  res,
  next
) {
  try {
    const resultado =
      await contaService
        .atualizarNotificacoesWhatsapp({
          usuarioId:
            req.user?.id,
          aceitaNotificacoes:
            req.body?.aceitaNotificacoes,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

/*
 * PUT /conta/senha
 */
async function alterarSenha(
  req,
  res,
  next
) {
  try {
    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {};

    const resultado =
      await contaService
        .alterarSenha({
          usuarioId:
            req.user?.id,

          senhaAtual:
            body.senhaAtual,

          novaSenha:
            body.novaSenha,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

/*
 * POST /conta/foto
 */
async function enviarFotoUsuario(
  req,
  res,
  next
) {
  try {
    const resultado =
      await contaService
        .enviarFotoUsuario({
          usuarioId:
            req.user?.id,

          arquivo:
            req.file,
        });

    return res.json(
      resultado
    );
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarMinhaConta,
  atualizarMinhaConta,
  atualizarPreferenciaWhatsapp,
  atualizarNotificacoesWhatsapp,
  alterarSenha,
  enviarFotoUsuario,
};
