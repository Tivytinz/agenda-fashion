const enfileiramento = require(
  "./whatsappMensagemEnfileiramentoRepository"
);
const fila = require("./whatsappMensagemFilaRepository");
const estado = require("./whatsappMensagemEstadoRepository");

module.exports = {
  ...enfileiramento,
  ...fila,
  ...estado,
};
