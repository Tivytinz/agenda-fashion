const encerramentoService = require(
  "../services/encerramentoService"
);

async function encerrarNegocio(req, res, next) {
  try {
    const resultado =
      await encerramentoService.encerrarNegocio({
        usuarioId: req.user?.id,
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function desativarConta(req, res, next) {
  try {
    const resultado =
      await encerramentoService.desativarConta({
        usuarioId: req.user?.id,
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function excluirConta(req, res, next) {
  try {
    const resultado =
      await encerramentoService.excluirContaDefinitivamente({
        usuarioId: req.user?.id,
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function consultarReservaDesativada(
  req,
  res,
  next
) {
  try {
    const resultado =
      await encerramentoService.consultarReservaClienteDesativado({
        agendamentoId: req.params.id,
        acesso:
          req.get("X-Agenda-Access") ||
          req.query?.token,
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

async function cancelarReservaDesativada(
  req,
  res,
  next
) {
  try {
    const resultado =
      await encerramentoService.cancelarReservaClienteDesativado({
        agendamentoId: req.params.id,
        acesso:
          req.body?.token ||
          req.query?.token,
      });

    return res.json(resultado);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = {
  encerrarNegocio,
  desativarConta,
  excluirConta,
  consultarReservaDesativada,
  cancelarReservaDesativada,
};
