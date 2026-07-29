const eventoProdutoService =
  require(
    "../services/eventoProdutoService"
  );

async function registrar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await eventoProdutoService
        .registrar({
          corpo:
            req.body,
          usuarioId:
            req.user?.id,
        });

    return res
      .status(202)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  registrar,
};
