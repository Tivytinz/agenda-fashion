const profissionaisRepository = require(
  "../repositories/profissionaisRepository"
);

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

  return profissionaisRepository
    .inativarProfissionaisExcedentesPlano(
      negocioId,
      executor
    );
}

module.exports = {
  reconciliarLimiteProfissionais,
};
