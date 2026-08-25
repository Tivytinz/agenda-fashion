const googleMeasurementService = require(
  "../services/googleMeasurementService"
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
      googleMeasurementService
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
      googleMeasurementService
        .sanitizarContextoCliente(
          req.body || {}
        );

    await googleMeasurementService
      .salvarConsentimento({
        usuarioId: req.user?.id,
        google: {
          consentimento:
            contexto.consentimento,
          client_id:
            contexto.clientId,
          texto_versao:
            contexto.textoVersao
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
