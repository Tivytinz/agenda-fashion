const profissionaisService = require("../services/profissionaisService");

async function listarProfissionais(req, res, next) {
  try {
    const resultado =
      await profissionaisService.listarProfissionais({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function editarProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.editarProfissional({
        usuarioId: req.user?.id,
        profissionalId: req.params.id,
        nome: req.body.nome,
        whatsapp: req.body.whatsapp
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function removerProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.removerProfissional({
        usuarioId: req.user?.id,
        profissionalId: req.params.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function vincularProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.vincularProfissional({
        usuarioDonoId: req.user?.id,
        emailOuWhatsapp: req.body.emailOuWhatsapp
      });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarProfissionais,
  vincularProfissional,
  editarProfissional,
  removerProfissional
};
