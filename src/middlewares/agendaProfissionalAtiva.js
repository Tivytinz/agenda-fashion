const sessaoRepository = require(
  "../repositories/sessaoRepository"
);
const {
  exigirUsuario,
  exigirPermissao
} = require("../validators/commonValidator");

async function agendaProfissionalAtiva(req, res, next) {
  try {
    const usuarioId = req.user?.id;

    exigirUsuario(usuarioId);

    const vinculo =
      await sessaoRepository.buscarContextoAtivoPorPapel(
        usuarioId,
        "profissional"
      );

    exigirPermissao(
      vinculo,
      "Seu acesso à agenda profissional não está ativo."
    );

    req.agendaContexto = {
      negocioId: vinculo.negocio_id,
      papel: vinculo.papel
    };

    return next();
  } catch (erro) {
    return next(erro);
  }
}

module.exports = agendaProfissionalAtiva;
