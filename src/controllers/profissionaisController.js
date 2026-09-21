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

async function ativarProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.ativarProfissional({
        usuarioId: req.user?.id,
        profissionalId: req.params.id
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

async function criarConviteProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.criarConviteProfissional({
        usuarioDonoId: req.user?.id,
        emailOuWhatsapp: req.body.emailOuWhatsapp
      });

    return res.status(201).json(resultado);
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

async function listarConvitesRecebidos(req, res, next) {
  try {
    const resultado =
      await profissionaisService.listarConvitesRecebidos({
        usuarioId: req.user?.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function aceitarConviteProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.aceitarConviteProfissional({
        usuarioId: req.user?.id,
        conviteId: req.params.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function recusarConviteProfissional(req, res, next) {
  try {
    const resultado =
      await profissionaisService.recusarConviteProfissional({
        usuarioId: req.user?.id,
        conviteId: req.params.id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listarProfissionais,
  vincularProfissional,
  criarConviteProfissional,
  listarConvitesRecebidos,
  aceitarConviteProfissional,
  ativarProfissional,
  recusarConviteProfissional,
  editarProfissional,
  removerProfissional
};
