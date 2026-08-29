const service = require(
  "../services/adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "../services/adminProfessionalAcquisitionCostService"
);

async function buscar(
  req,
  res,
  next
) {
  try {
    const periodo =
      req.query?.periodo;
    const [
      recorrencia,
      investimentos,
    ] = await Promise.all([
      service.buscarRecorrencia({
        periodo,
      }),
      acquisitionCostService
        .buscarInvestimentos(
          periodo
        ),
    ]);
    const resultado =
      acquisitionCostService
        .enriquecerRecorrencia({
          recorrencia,
          investimentos,
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
