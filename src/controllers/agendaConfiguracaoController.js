const agendaConfiguracaoService = require(
  "../services/agendaConfiguracaoService"
);

async function buscarMinhaConfiguracao(req, res, next) {
  try {
    const resultado =
      await agendaConfiguracaoService.buscarMinhaConfiguracao({
        usuarioId: req.user?.id,
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
        duracaoPadrao: req.body.duracaoPadrao,
        intervaloMinutos: req.body.intervaloMinutos,
        antecedenciaAgendamento:
          req.body.antecedenciaAgendamento,
        antecedenciaCancelamento:
          req.body.antecedenciaCancelamento,
        horarios: req.body.horarios,
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  buscarMinhaConfiguracao,
  salvarMinhaConfiguracao,
};