const configuracoesService = require(
  "../services/configuracoesService"
);

async function buscarConfiguracoes(
  req,
  res,
  next
) {
  try {
    const resultado =
      await configuracoesService
        .buscarConfiguracoes({
          usuarioId:
            req.user?.id,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function salvarConfiguracoes(
  req,
  res,
  next
) {
  try {
    const dados =
      req.body &&
      typeof req.body === "object" &&
      !Array.isArray(req.body)
        ? req.body
        : {};

    const resultado =
      await configuracoesService
        .salvarConfiguracoes({
          usuarioId:
            req.user?.id,

          dados,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function alterarPublicacao(
  req,
  res,
  next
) {
  try {
    const resultado =
      await configuracoesService
        .alterarPublicacao({
          usuarioId:
            req.user?.id,

          publicado:
            req.body?.publicado,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function enviarFotoNegocio(
  req,
  res,
  next
) {
  try {
    const resultado =
      await configuracoesService
        .enviarFotoNegocio({
          usuarioId:
            req.user?.id,

          arquivo:
            req.file,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarConfiguracoes,
  salvarConfiguracoes,
  enviarFotoNegocio,
  alterarPublicacao,
};
