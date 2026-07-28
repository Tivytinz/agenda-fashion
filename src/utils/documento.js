function normalizarDocumento(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function todosDigitosIguais(documento) {
  return /^(\d)\1+$/.test(documento);
}

function calcularDigito(documento, pesos) {
  const soma = pesos.reduce(
    (total, peso, indice) =>
      total + Number(documento[indice]) * peso,
    0
  );

  const resto = soma % 11;

  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(documento) {
  if (
    documento.length !== 11 ||
    todosDigitosIguais(documento)
  ) {
    return false;
  }

  const primeiroDigito = calcularDigito(
    documento,
    [10, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  const segundoDigito = calcularDigito(
    documento,
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return (
    primeiroDigito === Number(documento[9]) &&
    segundoDigito === Number(documento[10])
  );
}

function cnpjValido(documento) {
  if (
    documento.length !== 14 ||
    todosDigitosIguais(documento)
  ) {
    return false;
  }

  const primeiroDigito = calcularDigito(
    documento,
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  const segundoDigito = calcularDigito(
    documento,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return (
    primeiroDigito === Number(documento[12]) &&
    segundoDigito === Number(documento[13])
  );
}

function documentoValido(valor) {
  const documento = normalizarDocumento(valor);

  if (documento.length === 11) {
    return cpfValido(documento);
  }

  if (documento.length === 14) {
    return cnpjValido(documento);
  }

  return false;
}

module.exports = {
  documentoValido,
  normalizarDocumento
};
