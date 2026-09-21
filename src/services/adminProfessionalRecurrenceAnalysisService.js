const recurrenceService = require(
  "./adminProfessionalRecurrenceService"
);
const acquisitionCostService = require(
  "./adminProfessionalAcquisitionCostService"
);
const monetizationService = require(
  "./adminProfessionalRecurrenceMonetizationService"
);
const financialReadinessService = require(
  "./adminProfessionalRecurrenceFinancialReadinessService"
);

async function buscar({
  periodo,
  agora = new Date(),
} = {}) {
  const [
    baseRecorrencia,
    investimentos,
    investimentosDiarios,
  ] = await Promise.all([
    recurrenceService.buscarRecorrenciaComBase({
      periodo,
      agora,
    }),
    acquisitionCostService.buscarInvestimentos(
      periodo
    ),
    acquisitionCostService.buscarInvestimentosDiarios(
      periodo
    ),
  ]);

  const comCustos =
    acquisitionCostService.enriquecerRecorrencia({
      recorrencia:
        baseRecorrencia.recorrencia,
      linhasRecorrencia:
        baseRecorrencia.linhas,
      investimentos,
      investimentosDiarios,
      agora,
    });

  const comMonetizacao =
    monetizationService.enriquecerRecorrenciaComMonetizacao({
      recorrencia: comCustos,
      linhasRecorrencia:
        baseRecorrencia.linhas,
      agora,
    });

  return financialReadinessService
    .enriquecerRecorrenciaComProntidaoFinanceira({
      recorrencia: comMonetizacao,
      linhasRecorrencia:
        baseRecorrencia.linhas,
      investimentosDiarios,
      agora,
    });
}

module.exports = {
  buscar,
};
