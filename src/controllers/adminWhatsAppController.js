const adminWhatsAppService =
  require(
    "../services/adminWhatsAppService"
  );

async function buscarPainel(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminWhatsAppService
        .buscarPainel({
          periodo:
            req.query?.periodo,
        });

    return res
      .status(200)
      .json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  buscarPainel,
};
