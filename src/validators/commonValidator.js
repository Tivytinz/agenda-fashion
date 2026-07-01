const UnauthorizedError = require("../errors/UnauthorizedError");
const ForbiddenError = require("../errors/ForbiddenError");
const NotFoundError = require("../errors/NotFoundError");
const ValidationError = require("../errors/ValidationError");

function exigirUsuario(usuarioId) {
  if (!usuarioId) {
    throw new UnauthorizedError("Usuário não autenticado.");
  }
}

function exigirCliente(tipo) {
  if (tipo !== "cliente") {
    throw new ForbiddenError(
      "Apenas clientes podem realizar esta ação."
    );
  }
}

function exigirDono(vinculo) {
  if (!vinculo || vinculo.papel !== "dono") {
    throw new ForbiddenError(
      "Apenas o dono pode realizar esta operação."
    );
  }
}

function exigirRecurso(recurso, mensagem = "Recurso não encontrado.") {
  if (!recurso) {
    throw new NotFoundError(mensagem);
  }
}

function exigirCampo(valor, mensagem = "Campo obrigatório.") {
  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {
    throw new ValidationError(mensagem);
  }
}

module.exports = {
  exigirUsuario,
  exigirCliente,
  exigirDono,
  exigirRecurso,
  exigirCampo
};