const agendaRepository = require("../repositories/agendaRepository");
const {
  exigirUsuario,
  exigirPermissao
} = require("../validators/commonValidator");

async function agendaVinculoAtivo(req, res, next) {
  try {
    const usuarioId = req.user?.id;

    exigirUsuario(usuarioId);

    const vinculo =
      await agendaRepository.buscarVinculoUsuarioNegocio(usuarioId);

    exigirPermissao(
      vinculo,
      "Seu acesso à agenda não está ativo."
    );

    return next();
  } catch (erro) {
    return next(erro);
  }
}

module.exports = agendaVinculoAtivo;
