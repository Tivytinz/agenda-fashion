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

function classificarAuditoria(req) {
  if (req.method === "POST" &&
      /^\/admin\/auditoria\/[^/]+\/revisao$/.test(req.path)) {
    return { rota: "/admin/auditoria/:id/revisao", cenario: "REVISAO" };
  }
  if (req.method !== "GET" || req.path !== "/admin/auditoria") {
    return null;
  }

  const query = req.query || {};
  const chaves = Object.keys(query).filter((key) => !["pagina", "limite"].includes(key));
  if (chaves.length === 0) return { rota: req.path, cenario: "RECENTES" };
  if (chaves.length !== 1) return { rota: req.path, cenario: "OUTRO" };
  if (chaves[0] === "atorId" && typeof query.atorId === "string" &&
      /^[1-9]\d*$/.test(query.atorId)) {
    return { rota: req.path, cenario: "ATOR" };
  }
  if (chaves[0] === "resultado" &&
      ["PENDENTE", "REVISADA"].includes(query.resultado)) {
    return { rota: req.path, cenario: query.resultado };
  }
  return { rota: req.path, cenario: "OUTRO" };
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

        const auditoria = classificarAuditoria(req);
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
              auditoria?.rota || req.path,
            ...(auditoria ? { auditoria_cenario: auditoria.cenario } : {}),
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

module.exports.classificarAuditoria = classificarAuditoria;
