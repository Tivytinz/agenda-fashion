const PRIMEIRA_EXECUCAO_MS = 30000;
const INTERVALO_PADRAO_MS = 5 * 60 * 1000;
const INTERVALO_MINIMO_MS = 60 * 1000;
const INTERVALO_MAXIMO_MS = 60 * 60 * 1000;
const LOTE_PADRAO = 100;
const LOTE_MINIMO = 1;
const LOTE_MAXIMO = 500;

function inteiroLimitado(valor, padrao, minimo, maximo) {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return padrao;
  }

  return Math.min(maximo, Math.max(minimo, numero));
}

function intervaloMs() {
  return inteiroLimitado(
    process.env.BILLING_RECONCILIATION_INTERVAL_MS,
    INTERVALO_PADRAO_MS,
    INTERVALO_MINIMO_MS,
    INTERVALO_MAXIMO_MS
  );
}

function tamanhoLote() {
  return inteiroLimitado(
    process.env.BILLING_RECONCILIATION_BATCH_SIZE,
    LOTE_PADRAO,
    LOTE_MINIMO,
    LOTE_MAXIMO
  );
}

module.exports = {
  PRIMEIRA_EXECUCAO_MS,
  INTERVALO_PADRAO_MS,
  INTERVALO_MINIMO_MS,
  INTERVALO_MAXIMO_MS,
  LOTE_PADRAO,
  LOTE_MINIMO,
  LOTE_MAXIMO,
  intervaloMs,
  tamanhoLote,
};
