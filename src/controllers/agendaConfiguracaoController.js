const agendaConfiguracaoService = require(
  "../services/agendaConfiguracaoService"
);

function obterContextoAgenda(req) {
  return req.agendaContexto?.papel;
}

async function buscarMinhaConfiguracao(req, res, next) {
  try {
    const resultado =
      await agendaConfiguracaoService.buscarMinhaConfiguracao({
        usuarioId: req.user?.id,
        contexto: obterContextoAgenda(req),
        profissionalId:
          req.query?.profissionalId ||
          req.query?.profissional_id,
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarStatusConfiguracao(req, res, next) {
  try {
    const resultado =
      await agendaConfiguracaoService.buscarStatusConfiguracao({
        usuarioId: req.user?.id,
        contexto: obterContextoAgenda(req),
        profissionalId:
          req.query?.profissionalId ||
          req.query?.profissional_id,
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function salvarMinhaConfiguracao(req, res, next) {
  try {
    const resultado =
      await agendaConfiguracaoService.salvarMinhaConfiguracao({
        usuarioId: req.user?.id,
        contexto: obterContextoAgenda(req),
        profissionalId:
          req.body?.profissionalId ||
          req.body?.profissional_id,
        duracaoPadrao: req.body?.duracaoPadrao,
        intervaloMinutos: req.body?.intervaloMinutos,
        antecedenciaAgendamento:
          req.body?.antecedenciaAgendamento,
        antecedenciaCancelamento:
          req.body?.antecedenciaCancelamento,
        horarios: req.body?.horarios,
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarMinhaConfiguracao,
  buscarStatusConfiguracao,
  salvarMinhaConfiguracao,
};
