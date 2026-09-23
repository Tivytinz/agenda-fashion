const PRIMEIRA_EXECUCAO_MS = 30000;
const INTERVALO_PADRAO_MS = 300000;
const INTERVALO_MINIMO_MS = 60000;
const INTERVALO_MAXIMO_MS = 3600000;
const LOTE_PADRAO = 100;
const LOTE_MAXIMO = 500;

function inteiroSeguro(
  valor,
  fallback,
  minimo,
  maximo
) {
  const convertido = Number(valor);

  return (
    Number.isInteger(convertido) &&
    convertido >= minimo &&
    convertido <= maximo
  )
    ? convertido
    : fallback;
}

function intervaloMs(env = process.env) {
  return inteiroSeguro(
    env.ACQUISITION_FINANCIAL_RECONCILIATION_INTERVAL_MS,
    INTERVALO_PADRAO_MS,
    INTERVALO_MINIMO_MS,
    INTERVALO_MAXIMO_MS
  );
}

function tamanhoLote(env = process.env) {
  return inteiroSeguro(
    env.ACQUISITION_FINANCIAL_RECONCILIATION_BATCH_SIZE,
    LOTE_PADRAO,
    1,
    LOTE_MAXIMO
  );
}

module.exports = {
  PRIMEIRA_EXECUCAO_MS,
  intervaloMs,
  tamanhoLote,
};
