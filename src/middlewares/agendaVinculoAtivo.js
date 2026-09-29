const agendaRepository = require("../repositories/agendaRepository");
const {
  exigirUsuario,
  exigirPermissao
} = require("../validators/commonValidator");
const ValidationError = require(
  "../errors/ValidationError"
);

async function agendaVinculoAtivo(req, res, next) {
  try {
    const usuarioId = req.user?.id;

    exigirUsuario(usuarioId);

    const contextoSolicitado =
      String(
        req.get?.("X-AF-Contexto") ||
        ""
      )
        .trim()
        .toLowerCase();

    if (
      contextoSolicitado &&
      ![
        "dono",
        "profissional",
      ].includes(
        contextoSolicitado
      )
    ) {
      throw new ValidationError(
        "Contexto da agenda inválido."
      );
    }

    const papelSolicitado =
      contextoSolicitado ||
      null;

    const vinculo =
      await agendaRepository.buscarVinculoUsuarioNegocio(
        usuarioId,
        papelSolicitado
      );

    exigirPermissao(
      vinculo,
      "Seu acesso à agenda não está ativo."
    );

    req.agendaContexto = {
      negocioId: Number(
        vinculo.negocio_id
      ),
      papel: vinculo.papel,
      fusoHorario:
        vinculo.fuso_horario ||
        "America/Sao_Paulo",
    };

    return next();
  } catch (erro) {
    return next(erro);
  }
}

module.exports = agendaVinculoAtivo;
