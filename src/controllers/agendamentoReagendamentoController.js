const agendamentoReagendamentoService = require(
  "../services/agendamentoReagendamentoService"
);

async function reagendarOperacional(req, res, next) {
  try {
    const resultado =
      await agendamentoReagendamentoService
        .reagendarOperacional({
          usuarioId:
            req.user?.id,
          negocioId:
            req.agendaContexto?.negocioId,
          agendamentoId:
            req.params.id,
          data:
            req.body?.data,
          horario:
            req.body?.horario,
          profissionalId:
            req.body?.profissional_id,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  reagendarOperacional,
};
