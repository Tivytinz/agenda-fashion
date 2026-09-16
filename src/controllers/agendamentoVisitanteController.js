const agendamentoVisitanteService = require(
  "../services/agendamentoVisitanteService"
);

async function cancelar(
  req,
  res,
  next
) {
  try {
    const resultado =
      await agendamentoVisitanteService
        .cancelarAgendamentoVisitante({
          agendamentoId:
            req.params.id,
          acessoVisitante:
            req.body?.acesso_visitante,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  cancelar,
};