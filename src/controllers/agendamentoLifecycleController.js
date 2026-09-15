const agendamentoLifecycleService = require(
  "../services/agendamentoLifecycleService"
);

async function listarMeusAgendamentos(req, res, next) {
  try {
    const resultado =
      await agendamentoLifecycleService
        .listarMeusAgendamentos({
          clienteId: req.user?.id,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function avaliarAgendamento(req, res, next) {
  try {
    const resultado =
      await agendamentoLifecycleService
        .avaliarAgendamento({
          clienteId: req.user?.id,
          agendamentoId: req.params.id,
          avaliacao: req.body?.avaliacao,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarStatusAtendimento(req, res, next) {
  try {
    const resultado =
      await agendamentoLifecycleService
        .atualizarStatusAtendimento({
          usuarioId: req.user?.id,
          negocioId: req.agendaContexto?.negocioId,
          agendamentoId: req.params.id,
          status: req.body?.status,
        });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  listarMeusAgendamentos,
  avaliarAgendamento,
  atualizarStatusAtendimento,
};
