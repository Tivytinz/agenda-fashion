const AppError = require(
  "../errors/AppError"
);
const registrador = require(
  "../utils/registrador"
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

function resolverErroIntegridade(err) {
  if (
    err?.code === "23503" &&
    err?.constraint ===
      "agendamentos_servico_fk"
  ) {
    return {
      statusCode: 409,
      mensagem:
        "Este serviço possui agendamentos no histórico. Desative-o para impedir novas reservas sem perder os registros existentes.",
    };
  }

  if (
    err?.code === "23503" &&
    err?.constraint ===
      "agendamentos_profissional_negocio_vinculo"
  ) {
    return {
      statusCode: 409,
      mensagem:
        "Esta profissional não está mais vinculada a este negócio. Atualize a página e escolha uma profissional disponível.",
    };
  }

  return null;
}

function errorHandler(
  err,
  req,
  res,
  next
) {
  const erroIntegridade =
    resolverErroIntegridade(err);

  const statusInformado =
    Number(
      erroIntegridade?.statusCode ||
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
    Boolean(erroIntegridade) ||
    err instanceof AppError ||
    statusOperacional;

  if (
    deveRegistrarErro() &&
    !erroOperacional
  ) {
    registrador.erro(
      "Erro não tratado.",
      {
        mensagem:
          err?.message ||
          "Erro desconhecido.",

        codigo:
          err?.code || null,

        rota:
          req?.path ||
          null,

        metodo:
          req?.method ||
          null,

        id_requisicao:
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
        erroIntegridade?.statusCode ||
        (
          err instanceof AppError
            ? err.statusCode
            : statusInformado
        )
      )
      .json({
        erro:
          erroIntegridade?.mensagem ||
          err.message,
        codigo:
          err?.codigo ||
          undefined,
        pendencias:
          Array.isArray(err?.pendencias)
            ? err.pendencias
            : undefined,
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
