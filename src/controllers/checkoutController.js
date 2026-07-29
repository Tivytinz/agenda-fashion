const checkoutService = require("../services/checkoutService");

async function criarCheckout(req, res, next) {
  try {
    const resultado =
      await checkoutService.criarCheckout({
        usuarioId: req.user?.id,
        planoId: req.body.plano_id,
        formaPagamento: req.body.forma_pagamento,
        cpfCnpj: req.body.cpf_cnpj,
        chaveIdempotencia:
          req.get("Idempotency-Key")
      });

    return res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function consultarStatusCheckout(req, res, next) {
  try {
    const resultado =
      await checkoutService.consultarStatusCheckout({
        usuarioId: req.user?.id,
        pagamentoId: req.params.pagamento_id
      });

    return res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  criarCheckout,
  consultarStatusCheckout
};
