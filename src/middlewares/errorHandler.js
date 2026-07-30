const AppError = require(
  "../errors/AppError"
);

function deveRegistrarErro() {
  if (
    process.env.NODE_ENV !==
    "test"
  ) {
    return true;
  }

  return (
    process.env
      .DEBUG_TEST_ERRORS ===
    "true"
  );
}

function deveExibirDetalhes() {
  return (
    process.env.NODE_ENV !==
    "production"
  );
}

function errorHandler(
  err,
  req,
  res,
  next
) {
  const statusInformado =
    Number(
      err?.statusCode ||
      err?.status
    );

  const statusOperacional =
    Number.isInteger(
      statusInformado
    ) &&
    statusInformado >= 400 &&
    statusInformado < 500;

  const erroOperacional =
    err instanceof AppError ||
    statusOperacional;

  if (
    deveRegistrarErro() &&
    !erroOperacional
  ) {
    console.error(
      "[Erro não tratado]",
      {
        mensagem:
          err?.message ||
          "Erro desconhecido.",

        codigo:
          err?.code || null,

        rota:
          req?.originalUrl ||
          null,

        metodo:
          req?.method ||
          null,

        request_id:
          req?.id ||
          null,

        detalhe:
          deveExibirDetalhes()
            ? err?.detail || null
            : undefined,

        stack:
          deveExibirDetalhes()
            ? err?.stack || null
            : undefined
      }
    );
  }

  if (erroOperacional) {
    return res
      .status(
        err instanceof AppError
          ? err.statusCode
          : statusInformado
      )
      .json({
        erro:
          err.message,
        request_id:
          req?.id ||
          undefined,
      });
  }

  return res
    .status(500)
    .json({
      erro:
        "Erro interno do servidor.",
      request_id:
        req?.id ||
        undefined,
    });
}

module.exports =
  errorHandler;
