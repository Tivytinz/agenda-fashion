const service = require(
  "../services/adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "../services/adminProfessionalAcquisitionCostService"
);
const monetizationService = require(
  "../services/adminProfessionalRecurrenceMonetizationService"
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
    const comCustos =
      acquisitionCostService
        .enriquecerRecorrencia({
          recorrencia:
            baseRecorrencia.recorrencia,
          linhasRecorrencia:
            baseRecorrencia.linhas,
          investimentos,
          investimentosDiarios,
        });
    const resultado =
      monetizationService
        .enriquecerRecorrenciaComMonetizacao({
          recorrencia: comCustos,
          linhasRecorrencia:
            baseRecorrencia.linhas,
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
