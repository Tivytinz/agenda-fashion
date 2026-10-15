const agendaContextoRepository = require(
  "../repositories/agendaContextoRepository"
);
const NotFoundError = require(
  "../errors/NotFoundError"
);
const {
  exigirUsuario,
  exigirPermissao
} = require("../validators/commonValidator");

function normalizarId(valor) {
  const id = Number(valor);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function criarMiddleware({ permitirInativo = false } = {}) {
  return async function agendamentoOperacionalAtivo(req, res, next) {
    try {
      const usuarioId = normalizarId(req.user?.id);
      const agendamentoId = normalizarId(req.params?.id);

      exigirUsuario(usuarioId);
      exigirPermissao(
        agendamentoId,
        "Agendamento inválido."
      );

      const vinculo =
        await agendaContextoRepository
          .buscarVinculoOperacionalDoAgendamento({
            agendamentoId,
            usuarioId,
            permitirInativo,
          });

      if (!vinculo) {
        throw new NotFoundError(
          "Agendamento não encontrado."
        );
      }

      req.agendaContexto = {
        negocioId: Number(vinculo.negocio_id),
        papel: vinculo.papel
      };

      return next();
    } catch (erro) {
      return next(erro);
    }
  };
}

const agendamentoOperacionalAtivo = criarMiddleware();
agendamentoOperacionalAtivo.comReservasExistentes = criarMiddleware({
  permitirInativo: true,
});
module.exports = agendamentoOperacionalAtivo;
