module.exports =
  function notFound(
    req,
    res
  ) {
    return res
      .status(404)
      .json({
        erro:
          "Rota nao encontrada.",
        metodo:
          req.method,
        rota:
          req.originalUrl,
        request_id:
          req.id ||
          undefined,
      });
  };