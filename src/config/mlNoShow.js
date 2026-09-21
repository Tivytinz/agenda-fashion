const PRIMEIRA_EXECUCAO_MS = 60000;
const INTERVALO_PADRAO_MS = 15 * 60 * 1000;
const INTERVALO_MINIMO_MS = 60 * 1000;
const INTERVALO_MAXIMO_MS = 24 * 60 * 60 * 1000;
const LOTE_PADRAO = 100;
const LOTE_MINIMO = 1;
const LOTE_MAXIMO = 500;
const MINIMO_AMOSTRAS_ROTULADAS = 200;
const MINIMO_POR_CLASSE = 20;
const COBERTURA_MINIMA_DESFECHO = 0.8;

function flagAtiva(valor) {
  return ["1", "true", "yes", "on"].includes(
    String(valor || "").trim().toLowerCase()
  );
}

function inteiroLimitado(valor, padrao, minimo, maximo) {
  const numero = Number(valor);

  if (!Number.isInteger(numero)) {
    return padrao;
  }

  return Math.min(maximo, Math.max(minimo, numero));
}

function coletaAtiva() {
  return flagAtiva(
    process.env.ML_NO_SHOW_DATA_ENABLED
  );
}

function intervaloMs() {
  return inteiroLimitado(
    process.env.ML_NO_SHOW_DATA_INTERVAL_MS,
    INTERVALO_PADRAO_MS,
    INTERVALO_MINIMO_MS,
    INTERVALO_MAXIMO_MS
  );
}

function tamanhoLote() {
  return inteiroLimitado(
    process.env.ML_NO_SHOW_DATA_BATCH_SIZE,
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
  MINIMO_AMOSTRAS_ROTULADAS,
  MINIMO_POR_CLASSE,
  COBERTURA_MINIMA_DESFECHO,
  coletaAtiva,
  intervaloMs,
  tamanhoLote,
};
