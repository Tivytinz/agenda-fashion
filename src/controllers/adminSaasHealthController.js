const adminSaasHealthService =
  require(
    "../services/adminSaasHealthService"
  );

async function listarPerfisIncompletos(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminSaasHealthService
        .listarPerfisIncompletos({
          busca:
            req.query?.busca,
          limite:
            req.query?.limite,
          pagina:
            req.query?.pagina,
          pendencia:
            req.query?.pendencia,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listarPerfisIncompletos,
};
