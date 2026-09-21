const VALORES_ATIVOS = new Set([
  "1",
  "true",
  "yes",
  "sim",
  "on",
]);

const VALORES_INATIVOS = new Set([
  "0",
  "false",
  "no",
  "nao",
  "não",
  "off",
]);

function normalizarFlag(valor) {
  return String(valor || "").trim().toLowerCase();
}

function flagAtiva(valor) {
  return VALORES_ATIVOS.has(normalizarFlag(valor));
}

function valorFlagValido(valor, { permitirVazio = true } = {}) {
  const normalizado = normalizarFlag(valor);

  if (!normalizado) {
    return permitirVazio;
  }

  return (
    VALORES_ATIVOS.has(normalizado) ||
    VALORES_INATIVOS.has(normalizado)
  );
}

module.exports = {
  flagAtiva,
  valorFlagValido,
};
