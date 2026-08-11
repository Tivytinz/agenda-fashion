const adminProfessionalFunnelService =
  require(
    "../services/adminProfessionalFunnelService"
  );

async function buscar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await adminProfessionalFunnelService
        .buscarFunil({
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
  buscar,
};
