const service = require(
  "../services/adminProfessionalRecurrenceService"
);

async function buscar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await service.buscarRecorrencia({
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
