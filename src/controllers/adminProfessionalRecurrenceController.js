const service = require(
  "../services/adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "../services/adminProfessionalAcquisitionCostService"
);
const monetizationService = require(
  "../services/adminProfessionalRecurrenceMonetizationService"
);
const financialReadinessService = require(
  "../services/adminProfessionalRecurrenceFinancialReadinessService"
);
const financialDiagnosisService = require(
  "../services/adminProfessionalRecurrenceFinancialDiagnosisService"
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
    const comMonetizacao =
      monetizationService
        .enriquecerRecorrenciaComMonetizacao({
          recorrencia: comCustos,
          linhasRecorrencia:
            baseRecorrencia.linhas,
        });
    const comProntidao =
      financialReadinessService
        .enriquecerRecorrenciaComProntidaoFinanceira({
          recorrencia: comMonetizacao,
          linhasRecorrencia:
            baseRecorrencia.linhas,
          investimentosDiarios,
        });
    const resultado =
      financialDiagnosisService
        .enriquecerRecorrenciaComDiagnosticoExecutivo({
          recorrencia: comProntidao,
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
