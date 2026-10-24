const profissionaisRepository = require(
  "../repositories/profissionaisRepository"
);
const equipeAnalyticsService = require("./equipeAnalyticsService");

async function reconciliarLimiteProfissionais(
  negocioId,
  executor
) {
  if (
    !executor ||
    typeof executor.query !== "function"
  ) {
    throw new Error(
      "Conexão transacional inválida para reconciliar a equipe."
    );
  }

  await profissionaisRepository
    .bloquearCadastroProfissional(
      executor,
      negocioId
    );

  const inativadas = await profissionaisRepository
    .inativarProfissionaisExcedentesPlano(
      negocioId,
      executor
    );
  for (const profissional of inativadas) {
    await equipeAnalyticsService.registrarTransicao({
      negocioId, profissionalId: profissional.usuario_id, ativo: false,
      actorType: "SYSTEM", motivo: profissional.motivo_inatividade, executor,
    });
  }
  return inativadas;
}

module.exports = {
  reconciliarLimiteProfissionais,
};
