const agendamentoService = require("../services/agendaProfissionalService");

// =========================
// LISTAR AGENDA
// =========================
async function listarAgendaProfissional(req, res, next) {
  try {
    const resultado =
      await agendamentoService.listarAgendaProfissional({
        profissionalId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// =========================
// BLOQUEAR / DESBLOQUEAR
// =========================
async function alternarBloqueioHorario(req, res, next) {
  try {
    const resultado =
      await agendamentoService.alternarBloqueioHorario({
        profissionalId: req.user?.id,
        data: req.body.data,
        hora: req.body.hora
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarAgendaProfissional,
  alternarBloqueioHorario
};