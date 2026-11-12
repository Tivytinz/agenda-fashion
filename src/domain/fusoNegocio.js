const ValidationError = require("../errors/ValidationError");
const FUSOS_POR_ESTADO = require("../config/businessTimeZones.json");

// Alterações de endereço não podem conservar um fuso de outra UF.
// A ausência de escolha em UFs com mais de um fuso é erro explícito.
function resolverFusoNegocio({ estado, valor, atual, estadoAnterior }) {
  const opcoes = FUSOS_POR_ESTADO[estado] || [];
  const pedido = String(valor ?? "").trim();
  const anterior = String(atual ?? "").trim();
  const corresponde = (fuso) => opcoes.some((opcao) => opcao.value === fuso);
  if (pedido) {
    if (!corresponde(pedido)) {
      throw new ValidationError("Fuso horário incompatível com o estado do negócio.");
    }
    return pedido;
  }
  if (estado === estadoAnterior && corresponde(anterior)) return anterior;
  if (opcoes.length === 1) return opcoes[0].value;
  throw new ValidationError("Selecione o fuso horário da cidade do negócio.");
}

module.exports = { resolverFusoNegocio };
