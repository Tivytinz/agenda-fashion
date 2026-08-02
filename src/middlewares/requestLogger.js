const registrador = require(
  "../utils/registrador"
);

function deveIgnorar(
  req
) {
  return (
    req.originalUrl ===
      "/health/live" ||
    req.originalUrl ===
      "/health/ready"
  );
}

module.exports =
  function requestLogger(
    req,
    res,
    next
  ) {
    if (
      process.env.NODE_ENV === 
      "test"
    ) {
      return next();
    }
    
    const inicio =
      process.hrtime
        .bigint();

    res.once(
      "finish",
      () => {
        if (
          deveIgnorar(
            req
          )
        ) {
          return;
        }

        const duracaoNs =
          process.hrtime
            .bigint() -
          inicio;

        const duracaoMs =
          Number(
            duracaoNs
          ) / 1_000_000;

        registrador.informacao(
          "Requisição HTTP concluída.",
          {
            tipo:
              "requisicao_http",
            id_requisicao:
              req.id ||
              null,
            metodo:
              req.method,
            rota:
              req.originalUrl,
            status:
              res.statusCode,
            duracao_ms:
              Number(
                duracaoMs
                  .toFixed(2)
              ),
            usuario_id:
              req.user?.id ||
              null,
          }
        );
      }
    );

    next();
  };
