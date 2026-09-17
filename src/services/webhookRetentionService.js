const webhookRetentionRepository =
  require(
    "../repositories/webhookRetentionRepository"
  );

const DIAS_PADRAO = 180;
const DIAS_MINIMOS = 30;
const DIAS_MAXIMOS = 730;
const INTERVALO_EXECUCAO_MS =
  24 * 60 * 60 * 1000;

let ultimaTentativaEm = null;

function obterDiasRetencaoWebhooks() {
  const configurado =
    Number(
      process.env
        .WEBHOOK_RETENTION_DAYS
    );

  if (
    Number.isInteger(configurado) &&
    configurado >= DIAS_MINIMOS &&
    configurado <= DIAS_MAXIMOS
  ) {
    return configurado;
  }

  return DIAS_PADRAO;
}

function deveExecutarRetencao({
  agora,
  ultimaTentativa,
}) {
  const instanteAtual =
    Number(agora);

  const instanteAnterior =
    Number(ultimaTentativa);

  if (
    !Number.isFinite(instanteAtual)
  ) {
    return false;
  }

  if (
    !Number.isFinite(instanteAnterior) ||
    instanteAnterior <= 0
  ) {
    return true;
  }

  return (
    instanteAtual -
      instanteAnterior >=
    INTERVALO_EXECUCAO_MS
  );
}

async function executarSeNecessario({
  agora = Date.now(),
  forcar = false,
} = {}) {
  const instanteAtual =
    Number(agora);

  if (
    !forcar &&
    !deveExecutarRetencao({
      agora:
        instanteAtual,
      ultimaTentativa:
        ultimaTentativaEm,
    })
  ) {
    return {
      executada: false,
      redigidos: 0,
      diasRetencao:
        obterDiasRetencaoWebhooks(),
    };
  }

  ultimaTentativaEm =
    Number.isFinite(instanteAtual)
      ? instanteAtual
      : Date.now();

  const diasRetencao =
    obterDiasRetencaoWebhooks();

  const redigidos =
    await webhookRetentionRepository
      .redigirEventosFinalizadosAntigos(
        diasRetencao
      );

  return {
    executada: true,
    redigidos,
    diasRetencao,
  };
}

module.exports = {
  executarSeNecessario,
  obterDiasRetencaoWebhooks,
  deveExecutarRetencao,
};
