const agendaConfiguracaoService = require(
  "../services/agendaConfiguracaoService"
);

function obterContextoAgenda(req) {
  return req.get("X-AF-Contexto") || "dono";
}

async function buscarMinhaConfiguracao(req, res, next) {
  try {
    const resultado =
      await agendaConfiguracaoService.buscarMinhaConfiguracao({
        usuarioId: req.user?.id,
        contexto: obterContextoAgenda(req),
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
