const agendaContextoRepository = require(
  "../repositories/agendaContextoRepository"
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
      await agendaContextoRepository
        .buscarVinculoProfissionalAtivo(usuarioId);

    exigirPermissao(
      vinculo,
      "Seu acesso à agenda profissional não está ativo."
    );

    req.agendaContexto = {
      negocioId: Number(vinculo.negocio_id),
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

module.exports = agendaProfissionalAtiva;
