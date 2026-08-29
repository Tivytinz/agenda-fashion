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
      baseRecorrencia,
      investimentos,
      investimentosDiarios,
    ] = await Promise.all([
      service.buscarRecorrenciaComBase({
        periodo,
      }),
      acquisitionCostService
        .buscarInvestimentos(
          periodo
        ),
      acquisitionCostService
        .buscarInvestimentosDiarios(
          periodo
        ),
    ]);
    const resultado =
      acquisitionCostService
        .enriquecerRecorrencia({
          recorrencia:
            baseRecorrencia.recorrencia,
          linhasRecorrencia:
            baseRecorrencia.linhas,
          investimentos,
          investimentosDiarios,
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
