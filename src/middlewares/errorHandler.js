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
  const erroOperacional =
    err instanceof AppError;

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

  if (
    err instanceof
    AppError
  ) {
    return res
      .status(
        err.statusCode
      )
      .json({
        erro:
          err.message,
      });
  }

  return res
    .status(500)
    .json({
      erro:
        "Erro interno do servidor.",
    });
}

module.exports =
  errorHandler;
