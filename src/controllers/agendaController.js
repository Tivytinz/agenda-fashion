// =============================
// 🌍 BUSCAR AGENDA PÚBLICA
// =============================
const agendaService = require("../services/agendaService");
const agendaOperacionalService = require("../services/agendaOperacionalService");

async function buscarAgendaProfissional(req, res, next) {
  try {
    const resultado = await agendaService.buscarAgendaPublica({
      slugNegocio: req.params.slugNegocio,
      slugProfissional: req.params.slugProfissional
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =============================
// 👨‍🔧 AGENDA PROFISSIONAL
// =============================
async function listarAgendamentosFuncionario(req, res, next) {
  try {
    const resultado = await agendaOperacionalService.listarAgendaProfissional({
      profissionalId: req.user?.id,
      negocioId: req.agendaContexto?.negocioId
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =============================
// 🔒 BLOQUEAR / DESBLOQUEAR
// =============================
async function alternarBloqueioHorario(req, res, next) {
  try {
    const resultado = await agendaService.alternarBloqueioHorario({
      usuarioId: req.user?.id,
      data: req.body.data,
      hora: req.body.hora,
      profissionalIdSolicitado: req.body.profissional_id,
      negocioIdContexto:
        req.agendaContexto?.negocioId,
      papelContexto:
        req.agendaContexto?.papel
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarAgendaGeral(req, res, next) {
  try {
    const resultado = await agendaOperacionalService.buscarAgendaGeral({
      usuarioId: req.user?.id
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscarNotificacoesAgenda(req, res, next) {
  try {
    const resultado = await agendaService.buscarNotificacoesAgenda({
      usuarioId: req.user?.id
    });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =============================
module.exports = {
  buscarAgendaProfissional,
  listarAgendamentosFuncionario,
  alternarBloqueioHorario,
  buscarAgendaGeral,
  buscarNotificacoesAgenda
};
