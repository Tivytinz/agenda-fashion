const AppError = require(
  "../errors/AppError"
);

function deveExibirErro() {
  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    return false;
  }

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

function errorHandler(
  err,
  req,
  res,
  next
) {
  if (
    deveExibirErro()
  ) {
    console.error(
      "\nErro capturado pelo middleware:"
    );

    console.error({
      mensagem:
        err?.message,

      codigo:
        err?.code,

      detalhe:
        err?.detail,

      dica:
        err?.hint,

      tabela:
        err?.table,

      coluna:
        err?.column,

      restricao:
        err?.constraint,

      rota:
        req?.originalUrl,

      metodo:
        req?.method,
    });

    console.error(
      err?.stack ||
      err
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