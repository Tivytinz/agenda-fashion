const ValidationError = require("../errors/ValidationError");
const NotFoundError = require("../errors/NotFoundError");
const {
  consultarCepViaCep,
} = require("../providers/cepProvider");

function normalizarCep(value) {
  return String(value || "").replace(/\D/g, "");
}

async function buscarCep(value) {
  const cep = normalizarCep(value);

  if (cep.length !== 8) {
    throw new ValidationError(
      "Informe um CEP com 8 dígitos."
    );
  }

  const result = await consultarCepViaCep(cep);

  if (!result || result.erro) {
    throw new NotFoundError("CEP não encontrado.");
  }

  return {
    cep,
    endereco: result.logradouro || "",
    bairro: result.bairro || "",
    cidade: result.localidade || "",
    estado: result.uf || "",
  };
}

module.exports = {
  buscarCep,
  normalizarCep,
};
