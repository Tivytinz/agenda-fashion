const repository = require("../repositories/reservasProfissionaisRestritasRepository");
const { exigirUsuario } = require("../validators/commonValidator");
const ValidationError = require("../errors/ValidationError");

async function listar({ usuarioId, pagina = 1 }) {
  exigirUsuario(usuarioId);
  const numero = Number(pagina);
  if (!Number.isInteger(numero) || numero < 1 || numero > 10000) {
    throw new ValidationError("Página inválida.");
  }
  const tamanho = 20;
  const rows = await repository.listar({
    usuarioId, limite: tamanho + 1, offset: (numero - 1) * tamanho,
  });
  return {
    agendamentos: rows.slice(0, tamanho), pagina: numero, tem_proxima: rows.length > tamanho,
  };
}

module.exports = { listar };
