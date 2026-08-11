const metaAdsService = require(
  "../services/metaAdsService"
);
const AppError = require(
  "../errors/AppError"
);

function configuracaoPublica(
  _req,
  res,
  next
) {
  try {
    return res.status(200).json(
      metaAdsService
        .obterConfiguracaoPublica()
    );
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarConsentimento(
  req,
  res,
  next
) {
  try {
    if (
      typeof req.body?.consentimento !==
      "boolean"
    ) {
      throw new AppError(
        "Informe uma escolha válida de privacidade.",
        400
      );
    }

    const contexto =
      metaAdsService
        .sanitizarContextoCliente(
          req.body || {}
        );

    await metaAdsService
      .salvarConsentimento({
        usuarioId: req.user?.id,
        meta: {
          consentimento:
            contexto.consentimento,
          fbp: contexto.fbp,
          fbc: contexto.fbc
        }
      });

    return res.status(200).json({
      salvo: true,
      consentimento:
        contexto.consentimento
    });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  configuracaoPublica,
  atualizarConsentimento
};
